"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  rateCandidate,
  rerunEvaluation,
  setCandidateStatus,
} from "@/app/app/actions";
import type { AiEvaluation, CandidateStatus } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import { interpolate } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: CandidateStatus;
  rating: number | null;
  aiScore: number | null;
  aiEvaluation: AiEvaluation | null;
  appliedAt: string;
  completedAt: string | null;
  /** True when a frame was captured from the interview video. */
  hasAvatar: boolean;
  answers: {
    id: string;
    questionId: string;
    durationSec: number | null;
    transcript: string | null;
  }[];
};

type Question = { id: string; text: string };

const STATUS_ORDER: CandidateStatus[] = [
  "completed",
  "shortlisted",
  "interviewing",
  "applied",
  "rejected",
];

function useStatusMeta() {
  const t = useT();
  const meta: Record<CandidateStatus, { label: string; className: string }> = {
    applied: { label: t.candidates.st_applied, className: "text-muted-foreground" },
    interviewing: { label: t.candidates.st_interviewing, className: "text-sky-400" },
    completed: { label: t.candidates.st_completed, className: "text-primary" },
    shortlisted: { label: t.candidates.st_shortlisted, className: "text-emerald-400" },
    rejected: { label: t.candidates.st_rejected, className: "text-muted-foreground" },
  };
  return meta;
}

export function CandidatesReview({
  candidates,
  questions,
}: {
  candidates: CandidateRow[];
  questions: Question[];
}) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | "all">("all");
  const [sort, setSort] = useState<"newest" | "rating" | "ai">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = candidates;
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (sort === "rating") {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sort === "ai") {
      list = [...list].sort((a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1));
    }
    return list;
  }, [candidates, statusFilter, sort]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center pt-16 text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Users className="size-5" />
        </div>
        <p className="text-sm font-medium">{t.candidates.emptyTitle}</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {t.candidates.emptyDesc}
        </p>
      </div>
    );
  }

  if (selected) {
    return (
      <CandidateDetail
        candidate={selected}
        questions={questions}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as CandidateStatus | "all")}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.candidates.filterAll}</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {t.candidates[`st_${s}`]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as "newest" | "rating" | "ai")}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t.candidates.sortNewest}</SelectItem>
            <SelectItem value="ai">{t.candidates.sortAi}</SelectItem>
            <SelectItem value="rating">{t.candidates.sortRating}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card/30 px-3 py-6 text-center text-xs text-muted-foreground">
          {t.candidates.noMatch}
        </p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((c) => (
            <CandidateListItem
              key={c.id}
              candidate={c}
              onOpen={() => setSelectedId(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateListItem({
  candidate,
  onOpen,
}: {
  candidate: CandidateRow;
  onOpen: () => void;
}) {
  const meta = useStatusMeta()[candidate.status];
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border bg-card/50 p-2.5 text-left transition-colors hover:border-primary/40"
    >
      <Avatar className="size-9">
        {candidate.hasAvatar && (
          <AvatarImage
            src={`/api/media/candidate-avatar/${candidate.id}`}
            alt=""
          />
        )}
        <AvatarFallback className="text-xs">
          {candidate.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{candidate.name}</span>
          <StaticStars rating={candidate.rating ?? 0} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={meta.className}>{meta.label}</span>
          {candidate.answers.length > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Video className="size-3" />
              {candidate.answers.length}
            </span>
          )}
          {candidate.aiScore != null && (
            <span className="flex items-center gap-0.5 text-primary">
              <Sparkles className="size-3" />
              {candidate.aiScore}/10
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function CandidateDetail({
  candidate,
  questions,
  onBack,
}: {
  candidate: CandidateRow;
  questions: Question[];
  onBack: () => void;
}) {
  const t = useT();

  // Build the playlist in question order; only questions with an answer play.
  const answerByQ = new Map(candidate.answers.map((a) => [a.questionId, a]));
  const playlist = questions
    .map((q, i) => ({ q, index: i, answer: answerByQ.get(q.id) }))
    .filter((x): x is { q: Question; index: number; answer: NonNullable<typeof x.answer> } =>
      Boolean(x.answer),
    );

  const [current, setCurrent] = useState(0);
  const active = playlist[current];

  function next() {
    setCurrent((c) => (c + 1 < playlist.length ? c + 1 : c));
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {t.candidates.backToList}
      </button>

      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          {candidate.hasAvatar && (
            <AvatarImage
              src={`/api/media/candidate-avatar/${candidate.id}`}
              alt=""
            />
          )}
          <AvatarFallback className="text-sm">
            {candidate.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{candidate.name}</div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <a href={`mailto:${candidate.email}`} className="flex items-center gap-1 hover:text-foreground">
              <Mail className="size-3" />
              {candidate.email}
            </a>
            {candidate.phone && (
              <a href={`tel:${candidate.phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3" />
                {candidate.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      <Controls candidate={candidate} />

      <AiCard candidate={candidate} />

      {playlist.length > 0 && active ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              {interpolate(t.candidates.answersOf, {
                n: current + 1,
                m: playlist.length,
              })}
            </p>
            <p className="mb-2 text-sm font-medium leading-snug">
              {active.index + 1}. {active.q.text}
            </p>
            <video
              key={active.answer.id}
              controls
              autoPlay
              onEnded={next}
              className="w-full rounded-lg border bg-black"
              src={`/api/media/answer/${active.answer.id}`}
            />
            {active.answer.transcript && (
              <details className="mt-2 rounded-lg border bg-card/40 px-3 py-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {t.candidates.showTranscript}
                </summary>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {active.answer.transcript}
                </p>
              </details>
            )}
          </div>

          <div className="space-y-1">
            {playlist.map((item, i) => (
              <button
                key={item.answer.id}
                onClick={() => setCurrent(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                  i === current
                    ? "border-primary/50 bg-primary/5"
                    : "bg-card/40 hover:border-primary/30",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
                    i === current
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {i === current ? <Play className="size-2.5" /> : item.index + 1}
                </span>
                <span className="line-clamp-2 flex-1">{item.q.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed bg-card/30 px-3 py-4 text-center text-xs text-muted-foreground">
          {t.candidates.noVideos}
        </p>
      )}
    </div>
  );
}

function Controls({ candidate }: { candidate: CandidateRow }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/50 p-3">
      <InteractiveStars
        rating={candidate.rating ?? 0}
        onRate={(r) =>
          start(async () => {
            await rateCandidate(candidate.id, r);
            router.refresh();
          })
        }
      />
      <Select
        value={candidate.status}
        onValueChange={(v) =>
          start(async () => {
            await setCandidateStatus(candidate.id, v as CandidateStatus);
            router.refresh();
            toast.success(t.candidates.statusUpdated);
          })
        }
        disabled={pending}
      >
        <SelectTrigger size="sm" className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {t.candidates[`st_${s}`]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AiCard({ candidate }: { candidate: CandidateRow }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const data = candidate.aiEvaluation;

  function rerun() {
    start(async () => {
      const { ok } = await rerunEvaluation(candidate.id);
      router.refresh();
      if (!ok) toast.error(t.candidates.aiUnavailable);
    });
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <Sparkles className="size-4" />
          {t.candidates.aiTitle}
          {candidate.aiScore != null && (
            <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs tabular-nums">
              {candidate.aiScore}/10
            </span>
          )}
        </div>
        <button
          onClick={rerun}
          disabled={pending}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {pending ? t.candidates.aiPending : t.candidates.aiRerun}
        </button>
      </div>

      {data ? (
        <div className="space-y-2 text-xs">
          <p className="leading-relaxed text-foreground/90">{data.summary}</p>
          {data.strengths.length > 0 && (
            <div>
              <p className="font-medium text-emerald-500">
                {t.candidates.aiStrengths}
              </p>
              <ul className="ml-4 list-disc text-foreground/80">
                {data.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {data.concerns.length > 0 && (
            <div>
              <p className="font-medium text-amber-500">
                {t.candidates.aiConcerns}
              </p>
              <ul className="ml-4 list-disc text-foreground/80">
                {data.concerns.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {t.candidates.aiRecommendation}:{" "}
            </span>
            {data.recommendation}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t.candidates.aiNone}</p>
      )}
    </div>
  );
}

function StaticStars({ rating }: { rating: number }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3",
            rating >= n
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function InteractiveStars({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(n === rating ? 0 : n)}
          className="cursor-pointer p-0.5"
          aria-label={`${n}`}
        >
          <Star
            className={cn(
              "size-4",
              (hover || rating) >= n
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
