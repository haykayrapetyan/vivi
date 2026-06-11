"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { startVacancyFromPrompt } from "@/app/app/actions";
import { DRAFT_COOKIE, MAX_DRAFT_LEN } from "@/lib/draft";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/app/voice-input-button";

export function LandingHero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const busy = pending || redirecting;

  const examples = [
    t.landing.example1,
    t.landing.example2,
    t.landing.example3,
  ];

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    if (isLoggedIn) {
      start(() => startVacancyFromPrompt(text));
      return;
    }
    // Stash the draft so it survives the magic-link round-trip, then sign in.
    document.cookie = `${DRAFT_COOKIE}=${encodeURIComponent(
      text.slice(0, MAX_DRAFT_LEN),
    )}; path=/; max-age=1800; samesite=lax`;
    setRedirecting(true);
    router.push("/login");
  }

  return (
    <div className="mt-8 w-full max-w-2xl">
      <div className="flex items-end gap-2 rounded-2xl border bg-card p-2.5 text-left shadow-sm transition-colors focus-within:border-primary/50">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          autoFocus
          placeholder={t.landing.composerPlaceholder}
          className="max-h-52 min-h-[4rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {isLoggedIn && (
          <VoiceInputButton
            disabled={busy}
            onTranscript={(text) =>
              setInput((prev) => (prev ? `${prev.trim()} ${text}` : text))
            }
          />
        )}
        <Button
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          disabled={busy || !input.trim()}
          onClick={submit}
          aria-label={t.landing.ctaCreate}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setInput(ex)}
            className="rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
