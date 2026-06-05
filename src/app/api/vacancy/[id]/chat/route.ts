import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessage, interviewQuestion, vacancy } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getOwnedVacancy } from "@/lib/data";
import { VACANCY_SYSTEM_PROMPT } from "@/lib/ai";

export const maxDuration = 60;

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const owned = await getOwnedVacancy(id, session.user.id);
  if (!owned) {
    return new Response("Not found", { status: 404 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // Persist the latest user message.
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const content = textOf(last);
    if (content) {
      await db
        .insert(chatMessage)
        .values({ vacancyId: id, role: "user", content });
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
    system: VACANCY_SYSTEM_PROMPT,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      save_vacancy: tool({
        description:
          "Сохраняет/обновляет черновик вакансии: заголовок, описание в Markdown и вопросы для видеоинтервью.",
        inputSchema: z.object({
          title: z.string().describe("Короткий заголовок вакансии (должность)"),
          descriptionMd: z
            .string()
            .describe("Полное описание вакансии в формате Markdown"),
          details: z
            .object({
              company: z.string().optional(),
              location: z.string().optional(),
              employmentType: z.string().optional(),
              seniority: z.string().optional(),
              salaryRange: z.string().optional(),
              skills: z.array(z.string()).optional(),
            })
            .optional(),
          interviewQuestions: z
            .array(z.string())
            .min(3)
            .max(8)
            .describe("Открытые вопросы для видеоинтервью кандидата"),
        }),
        execute: async ({ title, descriptionMd, details, interviewQuestions }) => {
          await db
            .update(vacancy)
            .set({
              title: title?.trim() || owned.title,
              descriptionMd,
              details: details ?? owned.details ?? undefined,
            })
            .where(eq(vacancy.id, id));

          await db
            .delete(interviewQuestion)
            .where(eq(interviewQuestion.vacancyId, id));
          await db.insert(interviewQuestion).values(
            interviewQuestions
              .map((t) => t.trim())
              .filter(Boolean)
              .map((text, i) => ({ vacancyId: id, text, orderIndex: i })),
          );

          return {
            ok: true,
            savedQuestions: interviewQuestions.length,
          };
        },
      }),
    },
    onFinish: async ({ text }) => {
      const content = text?.trim();
      if (content) {
        await db
          .insert(chatMessage)
          .values({ vacancyId: id, role: "assistant", content });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
