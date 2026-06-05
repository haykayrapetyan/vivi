"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Mail,
  Phone,
  Star,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { rateCandidate, setCandidateStatus } from "@/app/app/actions";
import type { CandidateStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  completedAt: string | null;
  answers: {
    id: string;
    questionId: string;
    durationSec: number | null;
  }[];
};

const statusMeta: Record<
  CandidateStatus,
  { label: string; className: string }
> = {
  applied: { label: "Откликнулся", className: "text-muted-foreground" },
  interviewing: { label: "Проходит интервью", className: "text-sky-400" },
  completed: { label: "Интервью пройдено", className: "text-primary" },
  shortlisted: { label: "В шорт-листе", className: "text-emerald-400" },
  rejected: { label: "Отклонён", className: "text-muted-foreground" },
};

export function CandidatesReview({
  candidates,
  questions,
}: {
  candidates: CandidateRow[];
  questions: { id: string; text: string }[];
}) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center pt-16 text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Users className="size-5" />
        </div>
        <p className="text-sm font-medium">Пока нет откликов</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Опубликуйте вакансию и отправьте ссылку кандидатам. Их видеоинтервью
          появятся здесь.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {candidates.map((c) => (
        <CandidateCard key={c.id} candidate={c} questions={questions} />
      ))}
    </div>
  );
}

function CandidateCard({
  candidate,
  questions,
}: {
  candidate: CandidateRow;
  questions: { id: string; text: string }[];
}) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta[candidate.status];
  const hasVideos = candidate.answers.length > 0;
  const questionMap = new Map(questions.map((q, i) => [q.id, { ...q, index: i }]));

  return (
    <div className="rounded-xl border bg-card/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">
            {candidate.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {candidate.name}
            </span>
            <RatingStars rating={candidate.rating ?? 0} readOnly />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={meta.className}>{meta.label}</span>
            {hasVideos && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Video className="size-3" />
                {candidate.answers.length}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t p-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a
              href={`mailto:${candidate.email}`}
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail className="size-3" />
              {candidate.email}
            </a>
            {candidate.phone && (
              <a
                href={`tel:${candidate.phone}`}
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <Phone className="size-3" />
                {candidate.phone}
              </a>
            )}
          </div>

          <Controls candidate={candidate} />

          {hasVideos ? (
            <div className="space-y-3">
              {candidate.answers.map((a) => {
                const q = questionMap.get(a.questionId);
                return (
                  <div key={a.id}>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {q ? `${q.index + 1}. ${q.text}` : "Вопрос"}
                    </p>
                    <video
                      controls
                      preload="metadata"
                      className="w-full rounded-lg border bg-black"
                      src={`/api/media/answer/${a.id}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed bg-card/30 px-3 py-3 text-center text-xs text-muted-foreground">
              Кандидат ещё не записал видеоинтервью.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Controls({ candidate }: { candidate: CandidateRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3">
      <RatingStars
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
            toast.success("Статус обновлён");
          })
        }
        disabled={pending}
      >
        <SelectTrigger size="sm" className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="completed">Интервью пройдено</SelectItem>
          <SelectItem value="shortlisted">В шорт-лист</SelectItem>
          <SelectItem value="rejected">Отклонить</SelectItem>
          <SelectItem value="applied">Откликнулся</SelectItem>
          <SelectItem value="interviewing">Проходит интервью</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function RatingStars({
  rating,
  onRate,
  readOnly,
}: {
  rating: number;
  onRate?: (r: number) => void;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);

  // Read-only stars render as spans so they can live inside the card's
  // header <button> without producing invalid nested-button markup.
  if (readOnly) {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              "size-3.5",
              rating >= n
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate?.(n === rating ? 0 : n)}
          className="cursor-pointer"
          aria-label={`Оценка ${n}`}
        >
          <Star
            className={cn(
              "size-3.5",
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
