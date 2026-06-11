// The autonomous recruiter agent for ONE vacancy. A Durable Object instance
// per vacancy (instance name = vacancyId): globally unique, single-threaded
// (events are serialized for free), with its own persistent state and
// self-managed schedule. It wakes on events from the app (candidate completed,
// vacancy published) and on its own cron heartbeat, thinks with the LLM, and
// acts through the Next.js gateway.

import { Agent } from "agents";
import { generateText, stepCountIs, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import {
  NO_UPDATE,
  buildAgentSystemPrompt,
  buildCyclePrompt,
  buildScreeningPrompt,
} from "../../src/lib/agent/prompt";
import { kickoffKey, screenKey } from "../../src/lib/agent/keys";
import { daysWaiting, findStuckCandidates } from "../../src/lib/agent/stuck";
import type { VacancyContext } from "../../src/lib/agent/gateway-types";
import { Gateway } from "./gateway";
import type { Env } from "./types";

/** Weekdays 14:00 UTC ≈ morning for US recruiters. */
const HEARTBEAT_CRON = "0 14 * * 1-5";

type AgentState = {
  /** Idempotency ledger: units of work that already happened. */
  doneTasks: string[];
  /** When the last periodic review ran (ISO). */
  lastReviewAt: string | null;
};

export class VacancyAgent extends Agent<Env, AgentState> {
  initialState: AgentState = { doneTasks: [], lastReviewAt: null };

  /* ------------------------------ plumbing ------------------------------ */

  private gateway() {
    return new Gateway(this.env.APP_BASE_URL, this.env.AGENT_GATEWAY_SECRET);
  }

  private model() {
    const openai = createOpenAI({ apiKey: this.env.OPENAI_API_KEY });
    return openai(this.env.OPENAI_MODEL ?? "gpt-4o");
  }

  private taskDone(key: string) {
    return this.state.doneTasks.includes(key);
  }

  private recordTask(key: string) {
    if (this.taskDone(key)) return;
    this.setState({
      ...this.state,
      doneTasks: [...this.state.doneTasks, key],
    });
  }

  /** Keeps the recurring pool-review alarm alive (deduped by the SDK). */
  private async ensureHeartbeat() {
    await this.schedule(HEARTBEAT_CRON, "heartbeat", undefined, {
      idempotent: true,
    });
  }

  private systemPrompt(ctx: VacancyContext) {
    return buildAgentSystemPrompt({
      vacancyTitle: ctx.title,
      vacancyStatus: ctx.status,
      companyName: ctx.companyName,
      companyDescriptionMd: ctx.companyDescriptionMd,
      instructions: ctx.instructions,
    });
  }

  /* ------------------------------- events ------------------------------- */

  /**
   * A candidate finished their video interview: evaluate (app-side), write a
   * screening analysis into the vacancy chat, notify the recruiter.
   */
  async onCandidateCompleted(
    candidateId: string,
  ): Promise<{ ok: boolean; skipped?: string }> {
    const key = screenKey(candidateId);
    if (this.taskDone(key)) return { ok: true, skipped: "already screened" };

    const gw = this.gateway();
    const ctx = await gw.getContext(this.name);
    // The agent lives and dies with the vacancy lifecycle.
    if (ctx.status !== "published") {
      return { ok: true, skipped: `vacancy is ${ctx.status}` };
    }
    await this.ensureHeartbeat();

    // Transcription + structured evaluation run app-side (R2 + Whisper).
    const detail = await gw.evaluateCandidate(this.name, candidateId);

    let posted = false;
    if (this.env.OPENAI_API_KEY) {
      const { text } = await generateText({
        model: this.model(),
        system: this.systemPrompt(ctx),
        prompt: buildScreeningPrompt({
          candidateName: detail.name,
          answers: detail.answers,
          aiScore: detail.aiScore,
          aiEvaluation: detail.aiEvaluation,
          pool: ctx.pool
            .filter((p) => p.id !== candidateId)
            .map((p) => ({
              name: p.name,
              status: p.status,
              aiScore: p.aiScore,
              rating: p.rating,
            })),
        }),
      });
      if (text.trim()) {
        await gw.postMessage(this.name, text.trim());
        posted = true;
      }
    }

    await gw.notify(this.name, {
      candidateName: detail.name,
      aiScore: detail.aiScore,
      kind: posted ? "agent" : "completed",
    });

    this.recordTask(key);
    return { ok: true };
  }

  /**
   * The vacancy went live (first publish or reopen): introduce the agent in
   * the chat once, and make sure the periodic review schedule is running.
   */
  async onPublished(): Promise<{ ok: boolean; skipped?: string }> {
    const gw = this.gateway();
    const ctx = await gw.getContext(this.name);
    if (ctx.status !== "published") {
      return { ok: true, skipped: `vacancy is ${ctx.status}` };
    }
    await this.ensureHeartbeat();

    const key = kickoffKey(this.name);
    if (this.taskDone(key)) return { ok: true, skipped: "kickoff already posted" };
    if (!this.env.OPENAI_API_KEY) return { ok: true, skipped: "no model" };

    const { text } = await generateText({
      model: this.model(),
      system: this.systemPrompt(ctx),
      prompt: buildCyclePrompt({
        trigger: "published",
        vacancyTitle: ctx.title,
        pool: [],
        completedSinceLastRun: [],
        stuck: [],
        lastRunAt: null,
      }),
    });
    if (text.trim()) await gw.postMessage(this.name, text.trim());

    this.recordTask(key);
    return { ok: true };
  }

  /* ----------------------------- heartbeat ------------------------------ */

  /**
   * Cron-scheduled periodic pool review. Quiet rule: posts nothing when the
   * model answers NO_UPDATE. Never throws — a failed review just waits for
   * the next tick.
   */
  async heartbeat(): Promise<void> {
    try {
      const gw = this.gateway();
      const ctx = await gw.getContext(this.name);
      if (ctx.status !== "published" || !this.env.OPENAI_API_KEY) return;

      const now = new Date();
      const rows = ctx.pool.map((p) => ({
        name: p.name,
        status: p.status,
        createdAt: new Date(p.appliedAt),
        completedAt: p.completedAt ? new Date(p.completedAt) : null,
      }));
      const stuck = findStuckCandidates(rows, now);
      const last = this.state.lastReviewAt
        ? new Date(this.state.lastReviewAt)
        : null;
      const completedSince = ctx.pool
        .filter(
          (p) => p.completedAt && (!last || new Date(p.completedAt) > last),
        )
        .map((p) => p.name);

      const { text } = await generateText({
        model: this.model(),
        system: this.systemPrompt(ctx),
        prompt: buildCyclePrompt({
          trigger: "schedule",
          vacancyTitle: ctx.title,
          pool: ctx.pool.map((p) => ({
            name: p.name,
            status: p.status,
            aiScore: p.aiScore,
            rating: p.rating,
          })),
          completedSinceLastRun: completedSince,
          stuck: stuck.map((s) => ({
            name: s.name,
            daysWaiting: daysWaiting(s.createdAt, now),
          })),
          lastRunAt: this.state.lastReviewAt,
        }),
        tools: {
          list_candidates: tool({
            description: "The current candidate pool for this vacancy.",
            inputSchema: z.object({}),
            execute: async () => ({ candidates: ctx.pool }),
          }),
          get_candidate: tool({
            description:
              "Full candidate profile with AI evaluation and interview answer transcripts.",
            inputSchema: z.object({
              candidateId: z.string().describe("id from list_candidates"),
            }),
            execute: ({ candidateId }) =>
              gw.getCandidate(this.name, candidateId),
          }),
        },
        stopWhen: stepCountIs(6),
      });

      const out = text.trim();
      if (out && !out.startsWith(NO_UPDATE)) {
        await gw.postMessage(this.name, out);
      }
      this.setState({ ...this.state, lastReviewAt: now.toISOString() });
    } catch (e) {
      console.error("[VacancyAgent] heartbeat failed:", e);
    }
  }
}
