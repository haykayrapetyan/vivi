"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  Send,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration, pluralRu } from "@/lib/format";
import { useT, useLocale } from "@/lib/i18n/client";
import { interpolate } from "@/lib/i18n/dictionaries";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

type Q = { id: string; text: string };
type Phase = "intro" | "denied" | "question" | "review" | "done";

const MAX_SECONDS = 120;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o)) ?? "";
}

export function InterviewClient({
  token,
  candidateName,
  vacancyTitle,
  questions,
  answeredQuestionIds,
  completed,
}: {
  token: string;
  candidateName: string;
  vacancyTitle: string;
  questions: Q[];
  answeredQuestionIds: string[];
  completed: boolean;
}) {
  const t = useT();
  const answered = new Set(answeredQuestionIds);
  const firstUnanswered = questions.findIndex((q) => !answered.has(q.id));
  const startIndex = firstUnanswered === -1 ? questions.length : firstUnanswered;
  const allDone = completed || questions.length === 0 || startIndex >= questions.length;

  const [phase, setPhase] = useState<Phase>(allDone ? "done" : "intro");
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(questions.length - 1, 0)));
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const durationRef = useRef(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attach the live camera stream to the preview element.
  useEffect(() => {
    if (phase === "question" && !recordedUrl && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
      liveRef.current.play().catch(() => {});
    }
  }, [phase, recordedUrl, index]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setPhase("question");
    } catch {
      setPhase("denied");
    }
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = pickMimeType();
    const rec = new MediaRecorder(
      streamRef.current,
      mime ? { mimeType: mime } : undefined,
    );
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = chunksRef.current[0]?.type || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      blobRef.current = blob;
      durationRef.current = elapsedRef.current;
      setRecordedUrl(URL.createObjectURL(blob));
      setRecording(false);
      setPhase("review");
    };
    rec.start();
    recorderRef.current = rec;
    elapsedRef.current = 0;
    setElapsed(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= MAX_SECONDS) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  function retake() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    blobRef.current = null;
    elapsedRef.current = 0;
    setElapsed(0);
    setError(null);
    setPhase("question");
  }

  async function submit() {
    const blob = blobRef.current;
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const fd = new FormData();
      fd.append("questionId", questions[index].id);
      fd.append("durationSec", String(durationRef.current));
      fd.append("video", blob, `answer.${ext}`);
      const res = await fetch(`/api/interview/${token}/answer`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error();

      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      blobRef.current = null;
      elapsedRef.current = 0;
      setElapsed(0);

      const isLast = index + 1 >= questions.length;
      if (isLast) {
        await fetch(`/api/interview/${token}/complete`, { method: "POST" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setPhase("done");
      } else {
        setIndex((i) => i + 1);
        setPhase("question");
      }
    } catch {
      setError(t.interview.uploadError);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-6 py-5">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold tracking-tight"
        >
          Vivi
        </Link>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
          {vacancyTitle}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-16">
        {phase === "intro" && (
          <Intro
            candidateName={candidateName}
            count={questions.length}
            onStart={start}
          />
        )}

        {phase === "denied" && (
          <Centered>
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <VideoOff className="size-6" />
            </div>
            <h1 className="text-lg font-medium">{t.interview.deniedTitle}</h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t.interview.deniedDesc}
            </p>
            <Button className="mt-6" onClick={start}>
              {t.interview.retry}
            </Button>
          </Centered>
        )}

        {(phase === "question" || phase === "review") && (
          <div className="flex flex-1 flex-col">
            <Progress
              questions={questions}
              index={index}
              answered={answered}
            />

            <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {interpolate(t.interview.progress, {
                n: index + 1,
                m: questions.length,
              })}
            </p>
            <h1 className="mb-5 text-xl font-medium leading-snug">
              {questions[index]?.text}
            </h1>

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black">
              {phase === "review" && recordedUrl ? (
                <video
                  key={recordedUrl}
                  src={recordedUrl}
                  controls
                  autoPlay
                  className="size-full object-cover"
                />
              ) : (
                <video
                  ref={liveRef}
                  muted
                  playsInline
                  autoPlay
                  className="size-full -scale-x-100 object-cover"
                />
              )}
              {recording && (
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                  <span className="size-2 animate-pulse rounded-full bg-red-500" />
                  {formatDuration(elapsed)}
                </div>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}

            <div className="mt-5 flex items-center justify-center gap-3">
              {phase === "question" && !recording && (
                <Button size="lg" onClick={startRecording}>
                  <Video className="size-4" />
                  {t.interview.record}
                </Button>
              )}
              {phase === "question" && recording && (
                <Button size="lg" variant="destructive" onClick={stopRecording}>
                  <span className="size-2.5 rounded-xs bg-white" />
                  {t.interview.stop}
                </Button>
              )}
              {phase === "review" && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={retake}
                    disabled={uploading}
                  >
                    <RotateCcw className="size-4" />
                    {t.interview.retake}
                  </Button>
                  <Button size="lg" onClick={submit} disabled={uploading}>
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {index + 1 >= questions.length
                      ? t.interview.finish
                      : t.interview.submitNext}
                  </Button>
                </>
              )}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {interpolate(t.interview.maxNote, { min: MAX_SECONDS / 60 })}
            </p>
          </div>
        )}

        {phase === "done" && (
          <Centered>
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="text-lg font-medium">
              {interpolate(t.interview.doneTitle, { name: candidateName })}
            </h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {questions.length === 0
                ? t.interview.doneDescNoQuestions
                : t.interview.doneDesc}
            </p>
          </Centered>
        )}
      </main>
    </div>
  );
}

function Intro({
  candidateName,
  count,
  onStart,
}: {
  candidateName: string;
  count: number;
  onStart: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const qWord =
    locale === "ru"
      ? pluralRu(count, [t.interview.qOne, t.interview.qFew, t.interview.qMany])
      : count === 1
        ? t.interview.qOne
        : t.interview.qMany;

  return (
    <Centered>
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Video className="size-6" />
      </div>
      <h1 className="text-xl font-medium">
        {interpolate(t.interview.greeting, { name: candidateName })}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {interpolate(t.interview.introDesc, { count, questions: qWord })}
      </p>
      <ul className="mt-6 space-y-2 text-left text-sm text-muted-foreground">
        {[t.interview.tip1, t.interview.tip2, t.interview.tip3].map((tip) => (
          <li key={tip} className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            {tip}
          </li>
        ))}
      </ul>
      <Button size="lg" className="mt-8" onClick={onStart}>
        <Video className="size-4" />
        {t.interview.start}
      </Button>
    </Centered>
  );
}

function Progress({
  questions,
  index,
  answered,
}: {
  questions: Q[];
  index: number;
  answered: Set<string>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {questions.map((q, i) => (
        <div
          key={q.id}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < index || answered.has(q.id)
              ? "bg-primary"
              : i === index
                ? "bg-primary/40"
                : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {children}
    </div>
  );
}
