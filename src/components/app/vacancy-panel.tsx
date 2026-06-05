"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  publishVacancy,
  replaceQuestions,
  unpublishVacancy,
  updateVacancyDescription,
} from "@/app/app/actions";
import type { VacancyDetails, VacancyStatus } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function VacancyPanel({
  vacancy,
  questions,
  candidates,
}: {
  vacancy: PanelVacancy;
  questions: { id: string; text: string }[];
  candidates: CandidateRow[];
}) {
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="vacancy" className="flex h-full flex-col gap-0">
        <div className="border-b px-3 pt-3">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="vacancy" className="gap-1.5">
              <FileText className="size-3.5" /> {t.panel.tabVacancy}
            </TabsTrigger>
            <TabsTrigger value="candidates" className="gap-1.5">
              <Users className="size-3.5" /> {t.panel.tabCandidates}
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
      <ShareCard vacancy={vacancy} ready={ready} publicUrl={publicUrl} />

      {vacancy.details && <DetailsChips details={vacancy.details} />}

      <EditableDescription
        vacancyId={vacancy.id}
        descriptionMd={vacancy.descriptionMd}
      />

      <EditableQuestions vacancyId={vacancy.id} questions={questions} />
    </div>
  );
}

function EditableDescription({
  vacancyId,
  descriptionMd,
}: {
  vacancyId: string;
  descriptionMd: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(descriptionMd ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updateVacancyDescription(vacancyId, value);
        router.refresh();
        setEditing(false);
        toast.success(t.panel.savedToast);
      } catch {
        toast.error(t.panel.saveError);
      }
    });
  }

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <SectionTitle icon={<FileText className="size-3.5" />}>
          {t.panel.descriptionTitle}
        </SectionTitle>
        {!editing && (
          <EditButton
            label={t.common.edit}
            onClick={() => {
              setValue(descriptionMd ?? "");
              setEditing(true);
            }}
          />
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={12}
            placeholder={t.panel.descEditPlaceholder}
            className="font-mono text-xs"
            autoFocus
          />
          <EditActions
            pending={pending}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : descriptionMd ? (
        <Markdown>{descriptionMd}</Markdown>
      ) : (
        <Placeholder>{t.panel.descriptionPlaceholder}</Placeholder>
      )}
    </section>
  );
}

function EditableQuestions({
  vacancyId,
  questions,
}: {
  vacancyId: string;
  questions: { id: string; text: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function beginEdit() {
    setItems(questions.length ? questions.map((q) => q.text) : [""]);
    setEditing(true);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }

  function save() {
    start(async () => {
      try {
        await replaceQuestions(
          vacancyId,
          items.map((s) => s.trim()).filter(Boolean),
        );
        router.refresh();
        setEditing(false);
        toast.success(t.panel.savedToast);
      } catch {
        toast.error(t.panel.saveError);
      }
    });
  }

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <SectionTitle icon={<ListChecks className="size-3.5" />}>
          {t.panel.questionsTitle}
          {questions.length > 0 && (
            <span className="text-muted-foreground"> · {questions.length}</span>
          )}
        </SectionTitle>
        {!editing && (
          <EditButton label={t.common.edit} onClick={beginEdit} />
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {items.map((text, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-2 w-4 text-right text-xs text-muted-foreground">
                {i + 1}
              </span>
              <Textarea
                value={text}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  setItems(next);
                }}
                rows={2}
                placeholder={t.panel.questionTextPlaceholder}
                className="flex-1 text-sm"
              />
              <div className="flex flex-col">
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="up"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="down"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <button
                className="mt-1 p-0.5 text-muted-foreground hover:text-destructive"
                onClick={() => setItems(items.filter((_, k) => k !== i))}
                aria-label="remove"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 text-muted-foreground"
            onClick={() => setItems([...items, ""])}
          >
            <Plus className="size-4" />
            {t.panel.addQuestion}
          </Button>
          <EditActions
            pending={pending}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : questions.length ? (
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
        <Placeholder>{t.panel.questionsPlaceholder}</Placeholder>
      )}
    </section>
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
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const published = vacancy.status === "published" && publicUrl;

  function copy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success(t.panel.copyToast);
    setTimeout(() => setCopied(false), 1500);
  }

  if (published) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-500">
          <Globe className="size-4" />
          {t.panel.publishedTitle}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t.panel.publishedDesc}
        </p>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {publicUrl}
          </span>
          <button
            onClick={copy}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t.common.copy}
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
            aria-label={t.common.open}
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
          {t.panel.unpublish}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card/50 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Send className="size-4 text-primary" />
        {t.panel.publishTitle}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {ready ? t.panel.publishReady : t.panel.publishNotReady}
      </p>
      <Button
        size="sm"
        disabled={!ready || pending}
        onClick={() =>
          start(async () => {
            try {
              await publishVacancy(vacancy.id);
              router.refresh();
              toast.success(t.panel.publishedToast);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t.panel.publishError);
            }
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t.panel.publishBtn}
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

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Pencil className="size-3" />
      {label}
    </button>
  );
}

function EditActions({
  pending,
  onSave,
  onCancel,
}: {
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
        {t.common.cancel}
      </Button>
      <Button size="sm" onClick={onSave} disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t.common.save}
      </Button>
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
    <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
