"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  ListChecks,
  Loader2,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { publishVacancy, unpublishVacancy } from "@/app/app/actions";
import type { VacancyDetails, VacancyStatus } from "@/lib/db/schema";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidatesReview, type CandidateRow } from "./candidates-review";

export type PanelVacancy = {
  id: string;
  title: string;
  status: VacancyStatus;
  descriptionMd: string | null;
  publicSlug: string | null;
  details: VacancyDetails | null;
};

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function VacancyPanel({
  vacancy,
  questions,
  candidates,
}: {
  vacancy: PanelVacancy;
  questions: { id: string; text: string }[];
  candidates: CandidateRow[];
}) {
  const newCount = candidates.filter((c) => c.status === "completed").length;

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="vacancy" className="flex h-full flex-col gap-0">
        <div className="border-b px-3 pt-3">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="vacancy" className="gap-1.5">
              <FileText className="size-3.5" /> Вакансия
            </TabsTrigger>
            <TabsTrigger value="candidates" className="gap-1.5">
              <Users className="size-3.5" /> Кандидаты
              {candidates.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                  {candidates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="vacancy"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          <VacancyTab vacancy={vacancy} questions={questions} />
        </TabsContent>

        <TabsContent
          value="candidates"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          <CandidatesReview candidates={candidates} questions={questions} />
        </TabsContent>
      </Tabs>
      {newCount > 0 && <span className="sr-only">{newCount} new</span>}
    </div>
  );
}

function VacancyTab({
  vacancy,
  questions,
}: {
  vacancy: PanelVacancy;
  questions: { id: string; text: string }[];
}) {
  const ready = Boolean(vacancy.descriptionMd) && questions.length > 0;
  const publicUrl = vacancy.publicSlug ? `${appUrl}/v/${vacancy.publicSlug}` : null;

  return (
    <div className="space-y-6">
      <ShareCard
        vacancy={vacancy}
        ready={ready}
        publicUrl={publicUrl}
      />

      {vacancy.details && <DetailsChips details={vacancy.details} />}

      <section>
        <SectionTitle icon={<FileText className="size-3.5" />}>
          Описание
        </SectionTitle>
        {vacancy.descriptionMd ? (
          <Markdown>{vacancy.descriptionMd}</Markdown>
        ) : (
          <Placeholder>
            Описание появится здесь после диалога с AI в чате слева.
          </Placeholder>
        )}
      </section>

      <section>
        <SectionTitle icon={<ListChecks className="size-3.5" />}>
          Вопросы видеоинтервью
          {questions.length > 0 && (
            <span className="text-muted-foreground"> · {questions.length}</span>
          )}
        </SectionTitle>
        {questions.length ? (
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li
                key={q.id}
                className="flex gap-2.5 rounded-lg border bg-card/50 p-3 text-sm"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{q.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Placeholder>Вопросы для кандидатов сформирует AI.</Placeholder>
        )}
      </section>
    </div>
  );
}

function ShareCard({
  vacancy,
  ready,
  publicUrl,
}: {
  vacancy: PanelVacancy;
  ready: boolean;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const published = vacancy.status === "published" && publicUrl;

  function copy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Ссылка скопирована");
    setTimeout(() => setCopied(false), 1500);
  }

  if (published) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-500">
          <Globe className="size-4" />
          Вакансия опубликована
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Отправьте эту ссылку кандидатам — они увидят описание и пройдут
          видеоинтервью.
        </p>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {publicUrl}
          </span>
          <button
            onClick={copy}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Копировать"
          >
            {copied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
          <a
            href={publicUrl!}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Открыть"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground"
          disabled={pending}
          onClick={() => start(() => unpublishVacancy(vacancy.id))}
        >
          Снять с публикации
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card/50 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Send className="size-4 text-primary" />
        Публикация
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {ready
          ? "Описание и вопросы готовы. Опубликуйте, чтобы получить ссылку для кандидатов."
          : "Завершите описание и вопросы в чате — затем сможете опубликовать."}
      </p>
      <Button
        size="sm"
        disabled={!ready || pending}
        onClick={() =>
          start(async () => {
            try {
              await publishVacancy(vacancy.id);
              router.refresh();
              toast.success("Вакансия опубликована");
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Не удалось опубликовать",
              );
            }
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Опубликовать
      </Button>
    </div>
  );
}

function DetailsChips({ details }: { details: VacancyDetails }) {
  const chips = [
    details.company,
    details.location,
    details.employmentType,
    details.seniority,
    details.salaryRange,
  ].filter(Boolean) as string[];

  if (!chips.length && !details.skills?.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Badge key={c} variant="secondary" className="font-normal">
          {c}
        </Badge>
      ))}
      {details.skills?.map((s) => (
        <Badge key={s} variant="outline" className="font-normal">
          {s}
        </Badge>
      ))}
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h3>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed bg-card/30 px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
