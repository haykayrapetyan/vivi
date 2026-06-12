"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { updateAgentInstructions } from "@/app/app/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type AgentCardData = {
  /** Standing instructions (vacancy_agent.instructions). */
  instructions: string | null;
  /** Live presence from the Durable Object; null when the worker is off. */
  status: {
    lastReviewAt: string | null;
    nextHeartbeatAt: string | null;
    screenedCount: number;
  } | null;
};

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The vacancy's autonomous AI recruiter: presence + standing instructions. */
export function AgentCard({
  vacancyId,
  live,
  agent,
}: {
  vacancyId: string;
  /** Vacancy is published → the agent is active. */
  live: boolean;
  agent: AgentCardData;
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(agent.instructions ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updateAgentInstructions(vacancyId, value);
        router.refresh();
        setEditing(false);
        toast.success(t.panel.savedToast);
      } catch {
        toast.error(t.panel.saveError);
      }
    });
  }

  const s = agent.status;

  return (
    <section className="rounded-xl border bg-card/50 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" />
        {t.panel.agentTitle}
        <span
          className={
            "ml-auto inline-flex items-center gap-1.5 text-xs font-normal " +
            (live ? "text-emerald-500" : "text-muted-foreground")
          }
        >
          <span
            className={
              "size-1.5 rounded-full " +
              (live ? "bg-emerald-500" : "bg-muted-foreground/40")
            }
          />
          {live ? t.panel.agentLive : t.panel.agentDormant}
        </span>
      </div>

      {s && (s.lastReviewAt || s.nextHeartbeatAt || s.screenedCount > 0) && (
        <p className="mb-2 text-xs text-muted-foreground">
          {[
            s.screenedCount > 0 &&
              `${t.panel.agentScreened}: ${s.screenedCount}`,
            s.lastReviewAt &&
              `${t.panel.agentLastReview}: ${formatTs(s.lastReviewAt)}`,
            s.nextHeartbeatAt &&
              live &&
              `${t.panel.agentNextCheck}: ${formatTs(s.nextHeartbeatAt)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="mt-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.panel.agentInstructionsTitle}
          </span>
          {!editing && (
            <button
              onClick={() => {
                setValue(agent.instructions ?? "");
                setEditing(true);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="size-3" />
              {t.common.edit}
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t.panel.agentInstructionsPlaceholder}
              className="text-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {t.panel.agentInstructionsHint}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={pending}
              >
                {t.common.cancel}
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {t.common.save}
              </Button>
            </div>
          </div>
        ) : agent.instructions ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {agent.instructions}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t.panel.agentInstructionsEmpty}
          </p>
        )}
      </div>
    </section>
  );
}
