"use client";

import { useEffect, useState } from "react";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useT } from "@/lib/i18n/client";
import { useVacancyUi } from "@/components/app/vacancy-ui-context";
import {
  VacancyPanel,
  type PanelVacancy,
  type PanelMember,
} from "./vacancy-panel";
import type { AgentCardData } from "./agent-card";
import type { CandidateRow } from "./candidates-review";

export function VacancyPanelSheet({
  vacancy,
  questions,
  candidates,
  members,
  agent,
  viewedCandidateIds = [],
}: {
  vacancy: PanelVacancy;
  questions: { id: string; text: string }[];
  candidates: CandidateRow[];
  members: PanelMember[];
  agent: AgentCardData;
  viewedCandidateIds?: string[];
}) {
  const t = useT();
  const ui = useVacancyUi();
  const [open, setOpen] = useState(false);

  // Clicking a candidate in the chat opens the panel sheet on mobile.
  const selectionNonce = ui?.selection?.nonce;
  useEffect(() => {
    // Reacting to the cross-panel selection bus (an external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectionNonce != null) setOpen(true);
  }, [selectionNonce]);

  const viewed = new Set(viewedCandidateIds);
  const unread = candidates.filter((c) => !viewed.has(c.id)).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <PanelRight />
          {t.panel.details}
          {candidates.length > 0 && (
            <span
              className={
                unread > 0
                  ? "ml-0.5 rounded-full bg-primary px-1.5 text-[10px] tabular-nums text-primary-foreground"
                  : "ml-0.5 rounded-full bg-muted px-1.5 text-[10px] tabular-nums"
              }
            >
              {unread > 0 ? unread : candidates.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="gap-0 p-0"
        style={{ width: "min(420px, 92vw)", maxWidth: "min(420px, 92vw)" }}
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle className="truncate pr-8 text-sm font-medium">
            {vacancy.title}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <VacancyPanel
            vacancy={vacancy}
            questions={questions}
            candidates={candidates}
            members={members}
            agent={agent}
            viewedCandidateIds={viewedCandidateIds}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
