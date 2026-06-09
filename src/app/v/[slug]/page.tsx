import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Video } from "lucide-react";
import {
  getCompanyById,
  getPublicVacancy,
  getVacancyQuestions,
} from "@/lib/data";
import { getLocale, getServerDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/dictionaries";
import { pluralRu } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ApplyForm } from "./apply-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vacancy = await getPublicVacancy(slug);
  if (!vacancy) return { title: "Vivi" };
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

  const [questions, t, locale] = await Promise.all([
    getVacancyQuestions(vacancy.id),
    getServerDictionary(),
    getLocale(),
  ]);

  const companyRow = vacancy.companyId
    ? await getCompanyById(vacancy.companyId)
    : null;
  const companyName = companyRow?.name ?? vacancy.details?.company ?? null;

  const d = vacancy.details;
  const chips = [d?.location, d?.employmentType, d?.seniority, d?.salaryRange].filter(
    Boolean,
  ) as string[];

  const n = questions.length;
  const noteForms: [string, string, string] = [
    t.publicVacancy.questionsNoteOne,
    t.publicVacancy.questionsNoteFew,
    t.publicVacancy.questionsNoteMany,
  ];
  const questionsNote =
    locale === "ru"
      ? interpolate(pluralRu(n, noteForms), { count: n })
      : interpolate(n === 1 ? noteForms[0] : noteForms[2], { count: n });

  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(45%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
      />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Vivi
        </Link>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden text-xs text-muted-foreground sm:inline">
            {t.publicVacancy.respondHeader}
          </span>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-10 px-6 pb-24 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0">
          {companyName && (
            <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Briefcase className="size-3.5" />
              {companyName}
            </div>
          )}
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {vacancy.title}
          </h1>
          {chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <Badge key={c} variant="secondary" className="font-normal">
                  {c === d?.location && <MapPin className="size-3" />}
                  {c}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-7 border-t pt-7">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.publicVacancy.descriptionTitle}
            </h2>
            {vacancy.descriptionMd && (
              <Markdown className="text-[15px] leading-7">
                {vacancy.descriptionMd}
              </Markdown>
            )}
          </div>

          {d?.skills && d.skills.length > 0 && (
            <div className="mt-7">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.publicVacancy.skillsTitle}
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

          {companyRow?.descriptionMd && (
            <div className="mt-7 border-t pt-7">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.company.aboutTitle}
                {companyName ? ` · ${companyName}` : ""}
              </h2>
              <Markdown className="text-[15px] leading-7">
                {companyRow.descriptionMd}
              </Markdown>
            </div>
          )}
        </article>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-base font-medium">
              <Video className="size-4 text-primary" />
              {t.apply.header}
            </div>
            <ApplyForm slug={slug} />
            {n > 0 && (
              <p className="mt-5 border-t pt-4 text-center text-xs text-muted-foreground">
                {questionsNote}
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
