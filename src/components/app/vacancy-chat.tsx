"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  FileCheck2,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/app/voice-input-button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { interpolate } from "@/lib/i18n/dictionaries";

/** Per-message metadata carried through UIMessage.metadata. */
export type ChatMeta = {
  source?: "chat" | "auto";
  createdAt?: string;
};

function metaOf(m: UIMessage): ChatMeta {
  return (m.metadata ?? {}) as ChatMeta;
}

export function VacancyChat({
  vacancyId,
  initialMessages,
  initialPrompt,
  syncFrom,
}: {
  vacancyId: string;
  initialMessages: UIMessage[];
  initialPrompt?: string;
  /** ISO timestamp to poll for autonomous agent messages after. */
  syncFrom: string;
}) {
  const router = useRouter();
  const t = useT();
  const suggestions = [
    t.chat.suggestion1,
    t.chat.suggestion2,
    t.chat.suggestion3,
  ];
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/vacancy/${vacancyId}/chat`,
    }),
    messages: initialMessages,
    onFinish: () => router.refresh(),
  });

  const busy = status === "submitted" || status === "streaming";

  // Refs so the polling loop sees fresh state without re-subscribing.
  const messagesRef = useRef(initialMessages);
  const busyRef = useRef(false);
  const lastTsRef = useRef(syncFrom);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Poll for messages the agent posted autonomously (completed interviews,
  // digests) and merge them into the open thread. `useChat`'s message state
  // is initial-only, so a server refresh alone would never show them.
  useEffect(() => {
    let stopped = false;
    let inflight = false;

    const tick = async () => {
      if (stopped || inflight || busyRef.current || document.hidden) return;
      inflight = true;
      try {
        const res = await fetch(
          `/api/vacancy/${vacancyId}/chat/messages?after=${encodeURIComponent(
            lastTsRef.current,
          )}`,
        );
        if (!res.ok) return;
        const data: {
          messages: {
            id: string;
            role: string;
            content: string;
            createdAt: string;
          }[];
        } = await res.json();
        if (!data.messages.length) return;
        lastTsRef.current = data.messages[data.messages.length - 1].createdAt;

        const known = new Set(messagesRef.current.map((m) => m.id));
        const fresh: UIMessage[] = data.messages
          .filter((m) => !known.has(m.id))
          .map((m) => ({
            id: m.id,
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            parts: [{ type: "text" as const, text: m.content }],
            metadata: { source: "auto", createdAt: m.createdAt } as ChatMeta,
          }));
        if (fresh.length && !busyRef.current) {
          setMessages([...messagesRef.current, ...fresh]);
          router.refresh();
        }
      } catch {
        // Network hiccup — next tick will retry.
      } finally {
        inflight = false;
      }
    };

    const timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [vacancyId, setMessages, router]);

  // Auto-send the prompt carried over from the landing-page composer so the AI
  // starts building the vacancy immediately. Fires once, only for a fresh chat.
  useEffect(() => {
    const text = initialPrompt?.trim();
    if (!text || autoSentRef.current || initialMessages.length > 0) return;
    autoSentRef.current = true;
    sendMessage({ text });
    window.history.replaceState(null, "", `/app/v/${vacancyId}`);
  }, [initialPrompt, initialMessages.length, sendMessage, vacancyId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          {empty ? (
            <div className="flex flex-col items-center pt-10 text-center">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <h2 className="text-lg font-medium">{t.chat.emptyTitle}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t.chat.emptySubtitle}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage({ text: s })}
                    className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {status === "submitted" && <TypingBubble />}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {interpolate(t.chat.error, { message: error.message })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 focus-within:border-primary/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={t.chat.placeholder}
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <VoiceInputButton
              disabled={busy}
              onTranscript={(text) =>
                setInput((prev) => (prev ? `${prev.trim()} ${text}` : text))
              }
            />
            <Button
              size="icon"
              className="size-9 rounded-xl"
              disabled={busy || !input.trim()}
              onClick={submit}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const t = useT();
  const isUser = message.role === "user";
  const isAuto = metaOf(message).source === "auto";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground",
          isAuto && "border border-primary/25",
        )}
      >
        {isAuto && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <Sparkles className="size-3" />
            {t.chat.agentBadge}
          </div>
        )}
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return isUser ? (
              <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
                {part.text}
              </p>
            ) : (
              <Markdown key={i}>{part.text}</Markdown>
            );
          }
          if (part.type === "tool-save_vacancy") {
            const done = part.state === "output-available";
            return (
              <ToolChip key={i} done={done}>
                {done ? t.chat.draftUpdated : t.chat.draftUpdating}
              </ToolChip>
            );
          }
          if (
            part.type === "tool-list_candidates" ||
            part.type === "tool-get_candidate"
          ) {
            const done =
              "state" in part && part.state === "output-available";
            return (
              <ToolChip key={i} done={done} icon={<Users className="size-3.5" />}>
                {t.chat.checkingCandidates}
              </ToolChip>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function ToolChip({
  done,
  icon,
  children,
}: {
  done: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="my-1 flex items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground">
      {done ? (
        (icon ?? <FileCheck2 className="size-3.5 text-emerald-500" />)
      ) : (
        <Loader2 className="size-3.5 animate-spin" />
      )}
      {children}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-card px-4 py-3">
        <div className="flex gap-1">
          <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}
