import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { db } from "@/lib/db";
import { chatMessage } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getOrganization, getOwnedVacancy } from "@/lib/data";
import { buildAgentSystemPrompt } from "@/lib/agent/prompt";
import { buildVacancyTools } from "@/lib/agent/tools";
import { ensureVacancyAgent } from "@/lib/agent/store";

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

  // The same agent that runs autonomously: shared persona, tools and
  // standing instructions.
  const [org, agent] = await Promise.all([
    owned.organizationId ? getOrganization(owned.organizationId) : null,
    ensureVacancyAgent(id),
  ]);

  // Persist the latest user message (with the author, the chat is org-shared).
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const content = textOf(last);
    if (content) {
      await db.insert(chatMessage).values({
        vacancyId: id,
        role: "user",
        content,
        source: "chat",
        userId: session.user.id,
      });
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
    system: buildAgentSystemPrompt({
      vacancyTitle: owned.title,
      vacancyStatus: owned.status,
      companyName: org?.name,
      companyDescriptionMd: org?.descriptionMd,
      companyWebsite: org?.website,
      instructions: agent.instructions,
      canManageInstructions: true,
    }),
    messages: modelMessages,
    stopWhen: stepCountIs(12),
    tools: buildVacancyTools(owned),
    onFinish: async ({ text }) => {
      const content = text?.trim();
      if (content) {
        await db
          .insert(chatMessage)
          .values({ vacancyId: id, role: "assistant", content, source: "chat" });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
