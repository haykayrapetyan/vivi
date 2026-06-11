import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { requireUser } from "@/lib/session";
import {
  getAnswersByVacancy,
  getOrgMembers,
  getOwnedVacancy,
  getVacancyCandidates,
  getVacancyMessages,
  getVacancyQuestions,
} from "@/lib/data";
import { VacancyChat } from "@/components/app/vacancy-chat";
import { VacancyPanel } from "@/components/app/vacancy-panel";
import { VacancyPanelSheet } from "@/components/app/vacancy-panel-sheet";
import type { CandidateRow } from "@/components/app/candidates-review";

export default async function VacancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { id } = await params;
  const { prompt } = await searchParams;
  const user = await requireUser();
  const vacancy = await getOwnedVacancy(id, user.id);
  if (!vacancy) notFound();

  const [messages, questions, candidates, answers, members] = await Promise.all([
    getVacancyMessages(id),
    getVacancyQuestions(id),
    getVacancyCandidates(id),
    getAnswersByVacancy(id),
    vacancy.organizationId ? getOrgMembers(vacancy.organizationId) : [],
  ]);

  const initialMessages: UIMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text", text: m.content }],
    metadata: { source: m.source, createdAt: m.createdAt.toISOString() },
  }));

  // Where live polling for autonomous agent messages picks up.
  const syncFrom = (
    messages[messages.length - 1]?.createdAt ?? new Date()
  ).toISOString();

  const answersByCandidate = new Map<string, CandidateRow["answers"]>();
  for (const a of answers) {
    const list = answersByCandidate.get(a.candidateId) ?? [];
    list.push({
      id: a.id,
      questionId: a.questionId,
      durationSec: a.durationSec,
      transcript: a.transcript,
    });
    answersByCandidate.set(a.candidateId, list);
  }

  const candidateRows: CandidateRow[] = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    status: c.status,
    rating: c.rating,
    aiScore: c.aiScore,
    aiEvaluation: c.aiEvaluation,
    completedAt: c.completedAt?.toISOString() ?? null,
    answers: answersByCandidate.get(c.id) ?? [],
  }));

  const panelVacancy = {
    id: vacancy.id,
    title: vacancy.title,
    status: vacancy.status,
    descriptionMd: vacancy.descriptionMd,
    publicSlug: vacancy.publicSlug,
    details: vacancy.details,
    viewCount: vacancy.viewCount,
    ownerId: vacancy.userId,
  };
  const panelQuestions = questions.map((q) => ({ id: q.id, text: q.text }));
  const panelMembers = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    image: m.image,
  }));

  return (
    <div className="flex h-full min-w-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
            {vacancy.title}
          </h1>
          <VacancyPanelSheet
            vacancy={panelVacancy}
            questions={panelQuestions}
            candidates={candidateRows}
            members={panelMembers}
          />
        </header>
        <div className="min-h-0 flex-1">
          <VacancyChat
            vacancyId={id}
            initialMessages={initialMessages}
            initialPrompt={prompt}
            syncFrom={syncFrom}
          />
        </div>
      </section>

      <aside className="hidden w-[420px] shrink-0 border-l lg:block">
        <VacancyPanel
          vacancy={panelVacancy}
          questions={panelQuestions}
          candidates={candidateRows}
          members={panelMembers}
        />
      </aside>
    </div>
  );
}
