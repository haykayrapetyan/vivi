"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  FileCheck2,
  Globe,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { markChatRead } from "@/app/app/actions";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/app/voice-input-button";
import { useVacancyUi } from "@/components/app/vacancy-ui-context";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { interpolate } from "@/lib/i18n/dictionaries";

/** Per-message metadata carried through UIMessage.metadata. */
export type ChatMeta = {
  source?: "chat" | "auto";
  createdAt?: string;
};

export type ChatCandidate = { id: string; name: string };

export function VacancyChat({
  vacancyId,
  initialMessages,
  initialPrompt,
  syncFrom,
  candidates = [],
}: {
  vacancyId: string;
  initialMessages: UIMessage[];
  initialPrompt?: string;
  /** ISO timestamp to poll for autonomous agent messages after. */
  syncFrom: string;
  /** Vacancy candidates, so agent messages can link to them. */
  candidates?: ChatCandidate[];
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
  const taRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  // Auto-grow the composer with the text (grows upward; scrolls only past cap)
  // instead of an awkward fixed-height box with an inner scrollbar.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/vacancy/${vacancyId}/chat`,
    }),
    messages: initialMessages,
    onFinish: () => router.refresh(),
  });

  const busy = status === "submitted" || status === "streaming";

  // Refs so the polling/socket loops see fresh state without re-subscribing.
  const messagesRef = useRef(initialMessages);
  const busyRef = useRef(false);
  const lastTsRef = useRef(syncFrom);
  const wsConnectedRef = useRef(false);
  // Agent messages that arrived over WS while the assistant was streaming.
  const pendingRef = useRef<UIMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const mergeIncoming = useCallback(
    (incoming: UIMessage[]) => {
      const known = new Set(messagesRef.current.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (!fresh.length) return;
      if (busyRef.current) {
        // Don't touch useChat state mid-stream — flush when it settles.
        pendingRef.current.push(...fresh);
        return;
      }
      setMessages([...messagesRef.current, ...fresh]);
      // The chat is open, so what just arrived is instantly "read".
      void markChatRead(vacancyId);
      router.refresh();
    },
    [setMessages, router, vacancyId],
  );

  // Opening the chat clears the sidebar's unread-agent-messages badge.
  useEffect(() => {
    markChatRead(vacancyId).then(() => router.refresh());
  }, [vacancyId, router]);

  // Flush WS messages that were held back while streaming.
  useEffect(() => {
    if (busy || pendingRef.current.length === 0) return;
    const pending = pendingRef.current;
    pendingRef.current = [];
    mergeIncoming(pending);
  }, [busy, mergeIncoming]);

  // Realtime push: WebSocket straight to the vacancy's agent (Durable
  // Object). While connected, polling pauses; on failure it falls back.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/vacancy/${vacancyId}/agent-socket`);
        if (!res.ok) return; // no worker configured — polling covers us
        const info: { enabled: boolean; url?: string; token?: string } =
          await res.json();
        if (!info.enabled || !info.url || !info.token || stopped) return;

        ws = new WebSocket(
          `${info.url.replace(/^http/, "ws")}?token=${encodeURIComponent(info.token)}`,
        );
        ws.onopen = () => {
          wsConnectedRef.current = true;
        };
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(String(e.data)) as {
              type?: string;
              message?: {
                id: string;
                content: string;
                createdAt: string;
              };
            };
            if (data.type !== "agent_message" || !data.message) return;
            const m = data.message;
            if (m.createdAt > lastTsRef.current) lastTsRef.current = m.createdAt;
            mergeIncoming([
              {
                id: m.id,
                role: "assistant",
                parts: [{ type: "text", text: m.content }],
                metadata: { source: "auto", createdAt: m.createdAt } as ChatMeta,
              },
            ]);
          } catch {
            // Not ours (e.g. cf_agent_* frames) — ignore.
          }
        };
        ws.onclose = () => {
          wsConnectedRef.current = false;
          if (!stopped) retry = setTimeout(connect, 15_000);
        };
        ws.onerror = () => ws?.close();
      } catch {
        if (!stopped) retry = setTimeout(connect, 15_000);
      }
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      wsConnectedRef.current = false;
      ws?.close();
    };
  }, [vacancyId, mergeIncoming]);

  // Poll for messages the agent posted autonomously (completed interviews,
  // digests) and merge them into the open thread. `useChat`'s message state
  // is initial-only, so a server refresh alone would never show them.
  useEffect(() => {
    let stopped = false;
    let inflight = false;

    const tick = async () => {
      // The WebSocket delivers updates instantly — poll only as fallback.
      if (stopped || inflight || busyRef.current || document.hidden) return;
      if (wsConnectedRef.current) return;
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

        mergeIncoming(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            parts: [{ type: "text" as const, text: m.content }],
            metadata: { source: "auto", createdAt: m.createdAt } as ChatMeta,
          })),
        );
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
  }, [vacancyId, mergeIncoming]);

  // Auto-send the prompt carried over from the landing-page composer so the AI
  // starts building the vacancy immediately. Fires once, only for a fresh chat.
  useEffect(() => {
    const text = initialPrompt?.trim();
    if (!text || autoSentRef.current || initialMessages.length > 0) return;
    autoSentRef.current = true;
    sendMessage({ text });
    window.history.replaceState(null, "", `/app/v/${vacancyId}`);
  }, [initialPrompt, initialMessages.length, sendMessage, vacancyId]);

  // Jump to the latest message instantly on open; animate only for messages
  // that arrive while the chat is already on screen.
  const firstScrollRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: firstScrollRef.current ? "instant" : "smooth",
    });
    firstScrollRef.current = false;
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
                <MessageBubble key={m.id} message={m} candidates={candidates} />
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
        <div className="mx-auto w-full max-w-2xl px-4 py-2">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-1.5 focus-within:border-primary/50">
            <textarea
              ref={taRef}
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
              className="max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
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

function MessageBubble({
  message,
  candidates,
}: {
  message: UIMessage;
  candidates: ChatCandidate[];
}) {
  const t = useT();
  const isUser = message.role === "user";
  // Autonomous messages render exactly like interactive ones — it's all one
  // continuous conversation with the agent (metadata.source stays for sync).

  // The agent screens candidates by name; surface anyone it mentions as a
  // clickable card that opens them in the panel (assistant messages only).
  const text = isUser
    ? ""
    : message.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join(" ")
        .toLowerCase();
  const mentioned = isUser
    ? []
    : candidates.filter(
        (c) => c.name.trim().length > 1 && text.includes(c.name.toLowerCase()),
      );

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-card-foreground",
        )}
      >
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
          if (
            part.type === "tool-web_search" ||
            part.type === "tool-fetch_url"
          ) {
            const done =
              "state" in part && part.state === "output-available";
            return (
              <ToolChip key={i} done={done} icon={<Globe className="size-3.5" />}>
                {t.chat.searchingWeb}
              </ToolChip>
            );
          }
          return null;
        })}
        {mentioned.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mentioned.map((c) => (
              <CandidateRef key={c.id} candidate={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateRef({ candidate }: { candidate: ChatCandidate }) {
  const ui = useVacancyUi();
  return (
    <button
      type="button"
      onClick={() => ui?.selectCandidate(candidate.id)}
      className="flex items-center gap-1.5 rounded-lg border bg-background/60 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <Users className="size-3.5 text-primary" />
      {candidate.name}
    </button>
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
      <div className="rounded-2xl border bg-card px-4 py-3">
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
