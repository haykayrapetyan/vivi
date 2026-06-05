"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, FileCheck2, Loader2, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Senior Frontend разработчик, React, удалённо",
  "Менеджер по продажам B2B в Москве",
  "Продуктовый дизайнер, гибрид, middle+",
];

export function VacancyChat({
  vacancyId,
  initialMessages,
}: {
  vacancyId: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/vacancy/${vacancyId}/chat`,
    }),
    messages: initialMessages,
    onFinish: () => router.refresh(),
  });

  const busy = status === "submitted" || status === "streaming";

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
              <h2 className="text-lg font-medium">Опишите вакансию</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Напишите пару слов о роли — я задам уточняющие вопросы и помогу
                собрать описание и вопросы для видеоинтервью.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
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
              Ошибка: {error.message}. Проверьте, что задан OPENAI_API_KEY.
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
              placeholder="Сообщение AI-рекрутеру…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
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
          <p className="mt-1.5 px-1 text-center text-[11px] text-muted-foreground">
            AI может ошибаться. Проверяйте важные детали.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground",
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
              <div
                key={i}
                className="my-1 flex items-center gap-2 rounded-lg border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                {done ? (
                  <FileCheck2 className="size-3.5 text-emerald-500" />
                ) : (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {done ? "Черновик вакансии обновлён" : "Собираю черновик…"}
              </div>
            );
          }
          return null;
        })}
      </div>
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
