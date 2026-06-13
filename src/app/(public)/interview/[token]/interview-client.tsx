"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { interpolate } from "@/lib/i18n/dictionaries";
import { ThemeToggle } from "@/components/theme-toggle";

type Q = { id: string; text: string };
type Phase = "intro" | "resume" | "denied" | "question" | "review" | "done";

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
  hasResume,
  companyName,
  companyLogo,
}: {
  token: string;
  candidateName: string;
  vacancyTitle: string;
  questions: Q[];
  answeredQuestionIds: string[];
  completed: boolean;
  /** Whether the candidate already submitted a resume (skip the gate). */
  hasResume: boolean;
  /** The hiring company (branding shown to the candidate, not Vivi). */
  companyName: string | null;
  companyLogo: string | null;
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

  // "Start interview" → collect a resume first (unless already provided),
  // then ask for camera permission.
  function begin() {
    if (hasResume) start();
    else setPhase("resume");
  }

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

  // One-time avatar: a frame from the live camera when recording first starts.
  const avatarSentRef = useRef(false);
  function captureAvatar() {
    if (avatarSentRef.current) return;
    const video = liveRef.current;
    if (!video || video.videoWidth === 0) return;
    avatarSentRef.current = true;
    try {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Center-crop the frame to a square.
      const side = Math.min(video.videoWidth, video.videoHeight);
      ctx.drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      );
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const form = new FormData();
          form.append("image", blob, "avatar.jpg");
          // Best-effort — never block the interview over the avatar.
          void fetch(`/api/interview/${token}/avatar`, {
            method: "POST",
            body: form,
          }).catch(() => {});
        },
        "image/jpeg",
        0.85,
      );
    } catch {
      // Canvas hiccup — skip the avatar silently.
    }
  }

  function startRecording() {
    if (!streamRef.current) return;
    captureAvatar();
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

  async function uploadWithRetry(fd: FormData, attempts = 3) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await fetch(`/api/interview/${token}/answer`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) return;
        // Client errors won't succeed on retry — fail fast.
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`client_${res.status}`);
        }
        throw new Error(`server_${res.status}`);
      } catch (e) {
        const isClient =
          e instanceof Error && e.message.startsWith("client_");
        if (isClient || attempt === attempts) throw e;
        // Backoff before retrying transient (network/5xx) failures.
        await new Promise((r) => setTimeout(r, attempt * 1200));
      }
    }
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
      await uploadWithRetry(fd);

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
        <div className="flex min-w-0 items-center gap-2">
          {companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companyLogo}
              alt={companyName ?? ""}
              className="size-7 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
              {(companyName ?? "V").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-base font-semibold tracking-tight">
            {companyName ?? "Vivi"}
          </span>
        </div>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
          {vacancyTitle}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-16">
        {phase === "intro" && (
          <Intro
            candidateName={candidateName}
            count={questions.length}
            onStart={begin}
          />
        )}

        {phase === "resume" && (
          <ResumeGate token={token} onDone={start} />
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
            <Confetti />
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {interpolate(t.interview.doneTitle, { name: candidateName })}
            </h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {questions.length === 0
                ? t.interview.doneDescNoQuestions
                : t.interview.doneDesc}
            </p>

            {questions.length > 0 && (
              <div className="mt-8 w-full max-w-sm rounded-2xl border bg-card/50 p-5 text-left">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.interview.nextTitle}
                </p>
                <ul className="space-y-3">
                  <NextStep icon={<Search className="size-4" />}>
                    {interpolate(t.interview.next1, {
                      company: companyName ?? t.interview.theTeam,
                    })}
                  </NextStep>
                  <NextStep icon={<Mail className="size-4" />}>
                    {t.interview.next2}
                  </NextStep>
                  <NextStep icon={<Clock className="size-4" />}>
                    {t.interview.next3}
                  </NextStep>
                </ul>
              </div>
            )}
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
  const qWord = count === 1 ? t.interview.qOne : t.interview.qMany;

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

function ResumeGate({
  token,
  onDone,
}: {
  token: string;
  onDone: () => void;
}) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!url.trim() && !file) {
      setError(t.interview.resumeRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      if (url.trim()) fd.append("url", url.trim());
      if (file) fd.append("file", file);
      const res = await fetch(`/api/interview/${token}/resume`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || t.interview.resumeError);
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError(t.interview.resumeError);
      setBusy(false);
    }
  }

  return (
    <Centered>
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FileText className="size-6" />
      </div>
      <h1 className="text-xl font-medium">{t.interview.resumeTitle}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t.interview.resumeDesc}
      </p>

      <div className="mt-7 w-full max-w-sm space-y-3 text-left">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t.interview.resumeUrlLabel}
          </label>
          <Input
            type="url"
            inputMode="url"
            placeholder={t.interview.resumeUrlPlaceholder}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t.interview.resumeOr}
          <span className="h-px flex-1 bg-border" />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,application/pdf"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            if (error) setError(null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 font-normal"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="size-4 shrink-0" />
          <span className="min-w-0 truncate">
            {file ? file.name : t.interview.resumeChooseFile}
          </span>
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <Button size="lg" className="mt-7" onClick={submit} disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Video className="size-4" />
        )}
        {t.interview.resumeContinue}
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

function NextStep({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="leading-relaxed text-foreground/90">{children}</span>
    </li>
  );
}

const CONFETTI_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#22c55e",
  "#f59e0b",
  "#38bdf8",
];

type ConfettiPiece = {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
};

// A one-shot celebratory burst — self-contained, no dependency. Pieces fall
// once and fade out; the layer is non-interactive and removes nothing.
// Built in an effect (Math.random isn't allowed during render).
function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  useEffect(() => {
    // One-time randomized burst; Math.random can't run during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.4 + Math.random() * 1.6,
        size: 6 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    );
  }, []);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <style>{`@keyframes vivi-confetti-fall{0%{transform:translateY(-12vh) rotate(0);opacity:1}100%{transform:translateY(112vh) rotate(640deg);opacity:0}}`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.7,
            background: p.color,
            borderRadius: 2,
            animation: `vivi-confetti-fall ${p.duration}s cubic-bezier(0.3,0.6,0.7,1) ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
