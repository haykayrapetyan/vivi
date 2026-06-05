import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Video } from "lucide-react";
import { getPublicVacancy, getVacancyQuestions } from "@/lib/data";
import { pluralRu } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { ApplyForm } from "./apply-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vacancy = await getPublicVacancy(slug);
  if (!vacancy) return { title: "Вакансия не найдена" };
  return {
    title: `${vacancy.title}${
      vacancy.details?.company ? ` — ${vacancy.details.company}` : ""
    }`,
    description: vacancy.descriptionMd?.slice(0, 160),
  };
}

export default async function PublicVacancyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vacancy = await getPublicVacancy(slug);
  if (!vacancy) notFound();

  const questions = await getVacancyQuestions(vacancy.id);
  const d = vacancy.details;
  const chips = [d?.location, d?.employmentType, d?.seniority, d?.salaryRange].filter(
    Boolean,
  ) as string[];

  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
      />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Vivi
        </Link>
        <span className="text-xs text-muted-foreground">Отклик на вакансию</span>
      </header>

      <main className="mx-auto grid w-full max-w-3xl gap-8 px-6 pb-24 lg:grid-cols-[1fr_320px]">
        <article>
          {d?.company && (
            <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Briefcase className="size-3.5" />
              {d.company}
            </div>
          )}
          <h1 className="text-3xl font-semibold tracking-tight">
            {vacancy.title}
          </h1>
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <Badge key={c} variant="secondary" className="font-normal">
                  {c === d?.location && <MapPin className="size-3" />}
                  {c}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6 border-t pt-6">
            {vacancy.descriptionMd && (
              <Markdown className="text-[15px]">
                {vacancy.descriptionMd}
              </Markdown>
            )}
          </div>

          {d?.skills && d.skills.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Навыки
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {d.skills.map((s) => (
                  <Badge key={s} variant="outline" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </article>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              <Video className="size-4 text-primary" />
              Откликнуться
            </div>
            <ApplyForm slug={slug} />
            {questions.length > 0 && (
              <p className="mt-4 border-t pt-4 text-center text-xs text-muted-foreground">
                {questions.length}{" "}
                {pluralRu(questions.length, [
                  "вопрос",
                  "вопроса",
                  "вопросов",
                ])}{" "}
                в видеоинтервью
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
