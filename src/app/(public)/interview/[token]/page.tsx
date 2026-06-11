import { notFound } from "next/navigation";
import { Archive } from "lucide-react";
import {
  getCandidateByToken,
  getCandidateAnswers,
  getVacancyById,
  getVacancyQuestions,
} from "@/lib/data";
import { isAcceptingCandidates } from "@/lib/vacancy-lifecycle";
import { getServerDictionary } from "@/lib/i18n/server";
import { InterviewClient } from "./interview-client";

export const metadata = { title: "Video interview — Vivi" };

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

  // A closed/archived vacancy takes no more interviews — show a notice
  // instead of the recorder (already-completed candidates keep their state).
  if (!isAcceptingCandidates(vacancy.status) && candidate.status !== "completed") {
    const t = await getServerDictionary();
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-muted">
            <Archive className="size-5 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-medium">{t.interview.closedTitle}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t.interview.closedText}
          </p>
        </div>
      </div>
    );
  }

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
