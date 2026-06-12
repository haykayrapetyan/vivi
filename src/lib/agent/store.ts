import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentRun,
  agentTask,
  chatMessage,
  vacancy,
  vacancyAgent,
  type AgentRunStatus,
  type AgentTrigger,
  type VacancyAgent,
} from "@/lib/db/schema";

/** Vacancies whose agents are live (published + belong to an org). */
export async function listPublishedVacancyIds(): Promise<string[]> {
  const rows = await db
    .select({ id: vacancy.id })
    .from(vacancy)
    .where(
      and(eq(vacancy.status, "published"), isNotNull(vacancy.organizationId)),
    );
  return rows.map((r) => r.id);
}

/** Loads the per-vacancy agent row, creating the default (enabled, suggest) lazily. */
export async function ensureVacancyAgent(
  vacancyId: string,
): Promise<VacancyAgent> {
  const [existing] = await db
    .select()
    .from(vacancyAgent)
    .where(eq(vacancyAgent.vacancyId, vacancyId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(vacancyAgent)
    .values({ vacancyId })
    .onConflictDoNothing({ target: vacancyAgent.vacancyId })
    .returning();
  if (created) return created;

  // Lost a concurrent insert race — the row exists now.
  const [row] = await db
    .select()
    .from(vacancyAgent)
    .where(eq(vacancyAgent.vacancyId, vacancyId))
    .limit(1);
  return row;
}

/** All idempotency keys recorded for a vacancy (shared ledger for worker + fallback). */
export async function listAgentTaskKeys(vacancyId: string): Promise<string[]> {
  const rows = await db
    .select({ key: agentTask.key })
    .from(agentTask)
    .where(eq(agentTask.vacancyId, vacancyId));
  return rows.map((r) => r.key);
}

/**
 * Records a finished worker run in one shot (the worker reports outcomes
 * after the fact; only the inline fallback uses start/finish separately).
 */
export async function recordAgentRunReport(
  vacancyId: string,
  report: {
    trigger: AgentTrigger;
    status: AgentRunStatus;
    summary?: string;
    error?: string;
  },
) {
  await db.insert(agentRun).values({
    vacancyId,
    trigger: report.trigger,
    status: report.status,
    summary: report.summary,
    error: report.error,
    finishedAt: new Date(),
  });
  if (report.status === "done") {
    await db
      .update(vacancyAgent)
      .set({ lastRunAt: new Date() })
      .where(eq(vacancyAgent.vacancyId, vacancyId));
  }
}

/** Updates the agent's standing instructions (empty string clears them). */
export async function setAgentInstructions(
  vacancyId: string,
  instructions: string,
) {
  await ensureVacancyAgent(vacancyId);
  await db
    .update(vacancyAgent)
    .set({ instructions: instructions.trim().slice(0, 2000) || null })
    .where(eq(vacancyAgent.vacancyId, vacancyId));
}

/** Has this unit of agent work already been done? (see keys.ts) */
export async function hasAgentTask(key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: agentTask.id })
    .from(agentTask)
    .where(eq(agentTask.key, key))
    .limit(1);
  return Boolean(row);
}

/**
 * Records a completed unit of work. Inserted AFTER the work succeeds so a
 * crashed run is retried; the unique key makes concurrent duplicates no-ops.
 */
export async function recordAgentTask(
  vacancyId: string,
  key: string,
  runId: string | null,
) {
  await db
    .insert(agentTask)
    .values({ vacancyId, key, runId })
    .onConflictDoNothing({ target: agentTask.key });
}

export async function startAgentRun(
  vacancyId: string,
  trigger: AgentTrigger,
): Promise<string> {
  const [row] = await db
    .insert(agentRun)
    .values({ vacancyId, trigger })
    .returning({ id: agentRun.id });
  return row.id;
}

export async function finishAgentRun(
  id: string,
  outcome: { status: AgentRunStatus; summary?: string; error?: string },
) {
  await db
    .update(agentRun)
    .set({ ...outcome, finishedAt: new Date() })
    .where(eq(agentRun.id, id));
  if (outcome.status === "done") {
    const [run] = await db
      .select({ vacancyId: agentRun.vacancyId })
      .from(agentRun)
      .where(eq(agentRun.id, id))
      .limit(1);
    if (run) {
      await db
        .update(vacancyAgent)
        .set({ lastRunAt: new Date() })
        .where(eq(vacancyAgent.vacancyId, run.vacancyId));
    }
  }
}

/** Posts an autonomous agent message into the vacancy chat thread. */
export async function postAgentMessage(vacancyId: string, content: string) {
  const [row] = await db
    .insert(chatMessage)
    .values({ vacancyId, role: "assistant", content, source: "auto" })
    .returning();
  return row;
}
