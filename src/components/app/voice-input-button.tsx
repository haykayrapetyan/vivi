"use client";

import { useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

type State = "idle" | "recording" | "transcribing";

/**
 * Mic button that records a short clip, sends it to /api/voice/transcribe and
 * hands the text back via onTranscript. Uses MediaRecorder (same approach as
 * the candidate interview recorder).
 */
export function VoiceInputButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [state, setState] = useState<State>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        void transcribe(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      toast.error(t.chat.voiceMicError);
      setState("idle");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setState("transcribing");
  }

  async function transcribe(blob: Blob) {
    if (blob.size === 0) {
      setState("idle");
      return;
    }
    try {
      const form = new FormData();
      form.append("audio", blob, "voice.webm");
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: { text?: string } = await res.json();
      if (data.text?.trim()) onTranscript(data.text.trim());
      else toast.error(t.chat.voiceError);
    } catch {
      toast.error(t.chat.voiceError);
    } finally {
      setState("idle");
    }
  }

  const recording = state === "recording";
  const transcribing = state === "transcribing";

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled || transcribing}
      aria-label={recording ? t.chat.voiceStop : t.chat.voiceStart}
      title={transcribing ? t.chat.voiceTranscribing : undefined}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
        recording
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "text-muted-foreground hover:text-foreground disabled:opacity-40",
      )}
    >
      {transcribing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : recording ? (
        <Square className="size-4 fill-current" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
