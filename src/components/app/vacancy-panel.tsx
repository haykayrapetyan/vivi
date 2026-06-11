"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  ListChecks,
  Loader2,
  Lock,
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
  setVacancyOwner,
  setVacancyStatus,
  unpublishVacancy,
  updateVacancyDescription,
} from "@/app/app/actions";
import type { VacancyDetails, VacancyStatus } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import { vacancyParamRows } from "@/lib/vacancy-params";
import { VacancyHighlights } from "@/components/vacancy-highlights";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/app/user-avatar";
import { CandidatesReview, type CandidateRow } from "./candidates-review";

export type PanelMember = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
};

export type PanelVacancy = {
  id: string;
  title: string;
  status: VacancyStatus;
  descriptionMd: string | null;
  publicSlug: string | null;
  details: VacancyDetails | null;
  viewCount: number;
  ownerId: string;
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function VacancyPanel({
  vacancy,
  questions,
  candidates,
  members,
}: {
  vacancy: PanelVacancy;
  questions: { id: string; text: string }[];
  candidates: CandidateRow[];
  members: PanelMember[];
}) {
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="vacancy" className="flex h-full flex-col gap-0">
        <div className="border-b p-2.5">
          <TabsList className="w-full">
            <TabsTrigger value="vacancy" className="flex-1 gap-1.5">
              <FileText className="size-3.5" /> {t.panel.tabVacancy}
            </TabsTrigger>
            <TabsTrigger value="candidates" className="flex-1 gap-1.5">
              <Users className="size-3.5" /> {t.panel.tabCandidates}
              {candidates.length > 0 && (
                <span className="rounded-full bg-background/70 px-1.5 text-[10px] tabular-nums">
                  {candidates.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 gap-1.5">
              <BarChart3 className="size-3.5" /> {t.analytics.tab}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="vacancy"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          <VacancyTab vacancy={vacancy} questions={questions} members={members} />
        </TabsContent>

        <TabsContent
          value="candidates"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          <CandidatesReview candidates={candidates} questions={questions} />
        </TabsContent>

        <TabsContent
          value="analytics"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          <AnalyticsTab vacancy={vacancy} candidates={candidates} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VacancyTab({
  vacancy,
  questions,
  members,
}: {
  vacancy: PanelVacancy;
  questions: { id: string; text: string }[];
  members: PanelMember[];
}) {
  const ready = Boolean(vacancy.descriptionMd) && questions.length > 0;
  const publicUrl = vacancy.publicSlug ? `${appUrl}/v/${vacancy.publicSlug}` : null;

  return (
    <div className="space-y-6">
      <ShareCard vacancy={vacancy} ready={ready} publicUrl={publicUrl} />

      <OwnerRow
        vacancyId={vacancy.id}
        ownerId={vacancy.ownerId}
        members={members}
      />

      {vacancy.details && <ParamsList details={vacancy.details} />}

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

  function copy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success(t.panel.copyToast);
    setTimeout(() => setCopied(false), 1500);
  }

  function transition(status: VacancyStatus, doneToast?: string) {
    start(async () => {
      try {
        await setVacancyStatus(vacancy.id, status);
        router.refresh();
        if (doneToast) toast.success(doneToast);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t.panel.saveError);
      }
    });
  }

  if (vacancy.status === "published" && publicUrl) {
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
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label={t.common.open}
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={pending}
            onClick={() => transition("closed", t.panel.closedToast)}
          >
            <Lock className="size-3.5" />
            {t.panel.closeBtn}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={pending}
            onClick={() => start(() => unpublishVacancy(vacancy.id))}
          >
            {t.panel.unpublish}
          </Button>
        </div>
      </div>
    );
  }

  if (vacancy.status === "closed") {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-500">
          <Lock className="size-4" />
          {t.panel.closedTitle}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t.panel.closedDesc}</p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => transition("published", t.panel.reopenedToast)}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t.panel.reopenBtn}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={pending}
            onClick={() => transition("archived", t.panel.archivedToast)}
          >
            <Archive className="size-3.5" />
            {t.panel.archiveBtn}
          </Button>
        </div>
      </div>
    );
  }

  if (vacancy.status === "archived") {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Archive className="size-4" />
          {t.panel.archivedTitle}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t.panel.archivedDesc}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => transition("draft", t.panel.restoredToast)}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t.panel.restoreBtn}
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
      <div className="flex items-center gap-1">
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
                toast.error(
                  e instanceof Error ? e.message : t.panel.publishError,
                );
              }
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t.panel.publishBtn}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={pending}
          onClick={() => transition("archived", t.panel.archivedToast)}
        >
          <Archive className="size-3.5" />
          {t.panel.archiveBtn}
        </Button>
      </div>
    </div>
  );
}

function OwnerRow({
  vacancyId,
  ownerId,
  members,
}: {
  vacancyId: string;
  ownerId: string;
  members: PanelMember[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const owner =
    members.find((m) => m.userId === ownerId) ?? members[0] ?? null;

  function reassign(userId: string) {
    if (userId === ownerId) return;
    start(async () => {
      try {
        await setVacancyOwner(vacancyId, userId);
        router.refresh();
        toast.success(t.panel.ownerChanged);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t.panel.saveError);
      }
    });
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card/50 px-3 py-2.5">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.panel.owner}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={pending || members.length === 0}
            className="ml-auto flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-sm transition-colors hover:bg-accent disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserAvatar user={owner ?? {}} size="sm" />
            )}
            <span className="min-w-0 truncate">
              {owner?.name || owner?.email || t.panel.ownerUnassigned}
            </span>
            <Pencil className="size-3 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {members.map((m) => (
            <DropdownMenuItem
              key={m.userId}
              onSelect={() => reassign(m.userId)}
            >
              <UserAvatar user={m} size="sm" />
              <span className="min-w-0 flex-1 truncate">
                {m.name || m.email}
              </span>
              {m.userId === ownerId && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ParamsList({ details }: { details: VacancyDetails }) {
  const t = useT();
  const rows = vacancyParamRows(details, t);

  if (!rows.length && !details.skills?.length) return null;

  return (
    <div className="space-y-3">
      <VacancyHighlights rows={rows} />
      {details.skills && details.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {details.skills.map((s) => (
            <Badge key={s} variant="secondary" className="font-normal">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab({
  vacancy,
  candidates,
}: {
  vacancy: PanelVacancy;
  candidates: CandidateRow[];
}) {
  const t = useT();
  const views = vacancy.viewCount;
  const applies = candidates.length;
  const interviewed = candidates.filter((c) => c.answers.length > 0).length;
  const completed = candidates.filter(
    (c) =>
      c.status === "completed" ||
      c.status === "shortlisted" ||
      c.status === "rejected",
  ).length;
  const shortlisted = candidates.filter(
    (c) => c.status === "shortlisted",
  ).length;

  if (views === 0 && applies === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-card/30 px-3 py-8 text-center text-xs text-muted-foreground">
        {t.analytics.empty}
      </p>
    );
  }

  const steps = [
    { label: t.analytics.views, value: views },
    { label: t.analytics.applies, value: applies },
    { label: t.analytics.interviewed, value: interviewed },
    { label: t.analytics.completed, value: completed },
    { label: t.analytics.shortlisted, value: shortlisted },
  ];
  const max = Math.max(views, applies, 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t.analytics.views} value={views} />
        <Stat label={t.analytics.applies} value={applies} />
        <Stat label={t.analytics.completed} value={completed} />
        <Stat label={t.analytics.shortlisted} value={shortlisted} />
      </div>

      <div>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <BarChart3 className="size-3.5" /> {t.analytics.funnel}
        </h3>
        <div className="space-y-2">
          {steps.map((s, i) => {
            const prev = i === 0 ? null : steps[i - 1].value;
            const conv =
              prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="tabular-nums">
                    <span className="font-medium">{s.value}</span>
                    {conv !== null && (
                      <span className="ml-1.5 text-muted-foreground">
                        {conv}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((s.value / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card/50 p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
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
