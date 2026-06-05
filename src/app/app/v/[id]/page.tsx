import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { requireUser } from "@/lib/session";
import {
  getAnswersByVacancy,
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const vacancy = await getOwnedVacancy(id, user.id);
  if (!vacancy) notFound();

  const [messages, questions, candidates, answers] = await Promise.all([
    getVacancyMessages(id),
    getVacancyQuestions(id),
    getVacancyCandidates(id),
    getAnswersByVacancy(id),
  ]);

  const initialMessages: UIMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text", text: m.content }],
  }));

  const answersByCandidate = new Map<string, CandidateRow["answers"]>();
  for (const a of answers) {
    const list = answersByCandidate.get(a.candidateId) ?? [];
    list.push({
      id: a.id,
      questionId: a.questionId,
      durationSec: a.durationSec,
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
  };
  const panelQuestions = questions.map((q) => ({ id: q.id, text: q.text }));

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
          />
        </header>
        <div className="min-h-0 flex-1">
          <VacancyChat vacancyId={id} initialMessages={initialMessages} />
        </div>
      </section>

      <aside className="hidden w-[420px] shrink-0 border-l lg:block">
        <VacancyPanel
          vacancy={panelVacancy}
          questions={panelQuestions}
          candidates={candidateRows}
        />
      </aside>
    </div>
  );
}
