import { notFound } from "next/navigation";
import {
  getCandidateByToken,
  getCandidateAnswers,
  getVacancyById,
  getVacancyQuestions,
} from "@/lib/data";
import { InterviewClient } from "./interview-client";

export const metadata = { title: "Видеоинтервью — Vivi" };

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const candidate = await getCandidateByToken(token);
  if (!candidate) notFound();

  const [vacancy, questions, answers] = await Promise.all([
    getVacancyById(candidate.vacancyId),
    getVacancyQuestions(candidate.vacancyId),
    getCandidateAnswers(candidate.id),
  ]);
  if (!vacancy) notFound();

  const answeredIds = new Set(answers.map((a) => a.questionId));

  return (
    <InterviewClient
      token={token}
      candidateName={candidate.name}
      vacancyTitle={vacancy.title}
      questions={questions.map((q) => ({ id: q.id, text: q.text }))}
      answeredQuestionIds={[...answeredIds]}
      completed={candidate.status === "completed"}
    />
  );
}
