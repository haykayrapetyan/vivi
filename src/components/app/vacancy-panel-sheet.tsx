"use client";

import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VacancyPanel, type PanelVacancy } from "./vacancy-panel";
import type { CandidateRow } from "./candidates-review";

export function VacancyPanelSheet({
  vacancy,
  questions,
  candidates,
}: {
  vacancy: PanelVacancy;
  questions: { id: string; text: string }[];
  candidates: CandidateRow[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <PanelRight />
          Детали
          {candidates.length > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
              {candidates.length}
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
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
