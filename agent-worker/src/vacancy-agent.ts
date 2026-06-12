// The autonomous recruiter agent for ONE vacancy. A Durable Object instance
// per vacancy (instance name = vacancyId): globally unique, single-threaded
// (events are serialized for free), with its own persistent state and
// self-managed schedule. It wakes on events from the app (candidate completed,
// vacancy published) and on its own cron heartbeat, thinks with the LLM, and
// acts through the Next.js gateway.
//
// Idempotency: Postgres agent_task (via the gateway) is the single source of
// truth shared with the app's inline fallback; DO state keeps a local cache
// so repeat events short-circuit without a context fetch.

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
import {
  daysWaiting,
  findStuckCandidates,
  pickUnscreened,
} from "../../src/lib/agent/stuck";
import type {
  RunReport,
  VacancyContext,
} from "../../src/lib/agent/gateway-types";
import { Gateway, GatewayError } from "./gateway";
import type { Env } from "./types";

/** Weekdays 14:00 UTC ≈ morning for US recruiters. */
const HEARTBEAT_CRON = "0 14 * * 1-5";
/** Max catch-up screenings per heartbeat (bounds LLM cost). */
const SWEEP_LIMIT = 3;
/** Output cap per LLM call. */
const MAX_OUTPUT_TOKENS = 900;

type AgentState = {
  /** Local cache of the Postgres agent_task ledger. */
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

  /** Checked against the local cache AND the Postgres ledger in `ctx`. */
  private taskDone(key: string, ctx?: VacancyContext) {
    return (
      this.state.doneTasks.includes(key) ||
      Boolean(ctx?.doneTaskKeys.includes(key))
    );
  }

  /** Records the unit of work in Postgres (shared ledger) + local cache. */
  private async recordTask(key: string) {
    try {
      await this.gateway().recordTask(this.name, key);
    } catch (e) {
      console.error("[VacancyAgent] recordTask failed:", e);
    }
    if (!this.state.doneTasks.includes(key)) {
      this.setState({
        ...this.state,
        doneTasks: [...this.state.doneTasks, key],
      });
    }
  }

  /** Audit log in Postgres — best-effort, never fails the run. */
  private async report(report: RunReport) {
    try {
      await this.gateway().reportRun(this.name, report);
    } catch (e) {
      console.error("[VacancyAgent] reportRun failed:", e);
    }
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

  /** Posts to the vacancy chat AND pushes to connected browsers instantly. */
  private async post(content: string) {
    const { message } = await this.gateway().postMessage(this.name, content);
    try {
      this.broadcast(JSON.stringify({ type: "agent_message", message }));
    } catch {
      // No listeners / serialization hiccup — the chat polling still catches up.
    }
  }

  /** Presence for the app UI (read via the worker's /status route). */
  async getStatus(): Promise<{
    lastReviewAt: string | null;
    screenedCount: number;
    nextHeartbeatAt: string | null;
  }> {
    let nextHeartbeatAt: string | null = null;
    try {
      const schedules = this.getSchedules();
      const hb = schedules.find((s) => s.callback === "heartbeat");
      if (hb?.time) {
        // schedule.time is unix seconds.
        const ms = hb.time > 1e12 ? hb.time : hb.time * 1000;
        nextHeartbeatAt = new Date(ms).toISOString();
      }
    } catch {
      // schedules unavailable — presence stays partial
    }
    return {
      lastReviewAt: this.state.lastReviewAt,
      screenedCount: this.state.doneTasks.filter((k) =>
        k.startsWith("screen:"),
      ).length,
      nextHeartbeatAt,
    };
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
    if (this.taskDone(key, ctx)) {
      return { ok: true, skipped: "already screened (ledger)" };
    }
    // The agent lives and dies with the vacancy lifecycle.
    if (ctx.status !== "published") {
      return { ok: true, skipped: `vacancy is ${ctx.status}` };
    }
    await this.ensureHeartbeat();

    try {
      await this.screen(ctx, candidateId);
      await this.report({
        trigger: "candidate_completed",
        status: "done",
        summary: `Screened candidate ${candidateId}`,
      });
      return { ok: true };
    } catch (e) {
      await this.report({
        trigger: "candidate_completed",
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
      throw e; // 500 → the app falls back to the inline run
    }
  }

  /** The screening unit itself — also reused by the heartbeat catch-up sweep. */
  private async screen(ctx: VacancyContext, candidateId: string) {
    const gw = this.gateway();
    // Transcription + structured evaluation run app-side (R2 + Whisper).
    const detail = await gw.evaluateCandidate(this.name, candidateId);

    let posted = false;
    if (this.env.OPENAI_API_KEY) {
      const { text } = await generateText({
        model: this.model(),
        system: this.systemPrompt(ctx),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
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
        await this.post(text.trim());
        posted = true;
      }
    }

    await gw.notify(this.name, {
      candidateName: detail.name,
      aiScore: detail.aiScore,
      kind: posted ? "agent" : "completed",
    });

    await this.recordTask(screenKey(candidateId));
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
    if (this.taskDone(key, ctx)) {
      return { ok: true, skipped: "kickoff already posted" };
    }
    if (!this.env.OPENAI_API_KEY) return { ok: true, skipped: "no model" };

    try {
      const { text } = await generateText({
        model: this.model(),
        system: this.systemPrompt(ctx),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        prompt: buildCyclePrompt({
          trigger: "published",
          vacancyTitle: ctx.title,
          pool: [],
          completedSinceLastRun: [],
          stuck: [],
          lastRunAt: null,
        }),
      });
      if (text.trim()) await this.post(text.trim());
      await this.recordTask(key);
      await this.report({
        trigger: "published",
        status: "done",
        summary: "Posted kickoff introduction",
      });
      return { ok: true };
    } catch (e) {
      await this.report({
        trigger: "published",
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  /* ----------------------------- heartbeat ------------------------------ */

  /**
   * Cron-scheduled periodic pool review. First sweeps completed-but-never-
   * screened candidates (lost events), then reviews the pool. Deterministic
   * short-circuit keeps quiet days free; the LLM's NO_UPDATE rule covers the
   * rest. Never throws — a failed review waits for the next tick.
   */
  async heartbeat(): Promise<void> {
    try {
      const gw = this.gateway();
      let ctx = await gw.getContext(this.name);
      if (ctx.status !== "published" || !this.env.OPENAI_API_KEY) return;

      const now = new Date();

      // Catch-up sweep: screenings that never happened (at-least-once).
      const localDone = this.state.doneTasks;
      const ledger = [...new Set([...ctx.doneTaskKeys, ...localDone])];
      const unscreened = pickUnscreened(ctx.pool, ledger, screenKey, SWEEP_LIMIT);
      for (const cand of unscreened) {
        try {
          await this.screen(ctx, cand.id);
        } catch (e) {
          console.error("[VacancyAgent] sweep screening failed:", e);
        }
      }
      if (unscreened.length) {
        // Pool data changed (fresh evaluations) — re-fetch before the review.
        ctx = await gw.getContext(this.name);
      }

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

      // Deterministic short-circuit: no new interviews, nobody stalled,
      // nothing swept — don't even wake the model.
      if (!completedSince.length && !stuck.length && !unscreened.length) {
        this.setState({ ...this.state, lastReviewAt: now.toISOString() });
        await this.report({
          trigger: "schedule",
          status: "skipped",
          summary: "Nothing new since the last review — stayed quiet",
        });
        return;
      }

      const { text } = await generateText({
        model: this.model(),
        system: this.systemPrompt(ctx),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
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
      const quiet = !out || out.startsWith(NO_UPDATE);
      if (!quiet) await this.post(out);
      this.setState({ ...this.state, lastReviewAt: now.toISOString() });
      await this.report({
        trigger: "schedule",
        status: quiet ? "skipped" : "done",
        summary: quiet
          ? "Reviewed the pool — no update worth posting"
          : `Posted periodic review (${ctx.pool.length} candidates, ${stuck.length} stalled, ${unscreened.length} swept)`,
      });
    } catch (e) {
      // The vacancy is gone (deleted) — stop ticking forever.
      if (e instanceof GatewayError && e.status === 404) {
        for (const s of this.getSchedules()) {
          if (s.callback === "heartbeat") await this.cancelSchedule(s.id);
        }
        console.warn("[VacancyAgent] vacancy gone — heartbeat cancelled");
        return;
      }
      console.error("[VacancyAgent] heartbeat failed:", e);
      await this.report({
        trigger: "schedule",
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
