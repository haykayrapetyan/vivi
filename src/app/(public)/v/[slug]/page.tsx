import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Archive, ChevronRight, Video } from "lucide-react";
import {
  getOrganization,
  getPublicVacancy,
  getVacancyQuestions,
} from "@/lib/data";
import { getServerDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/dictionaries";
import { vacancyParamRows } from "@/lib/vacancy-params";
import { VacancyHighlights } from "@/components/vacancy-highlights";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ApplyForm } from "./apply-form";
import { ViewBeacon } from "./view-beacon";

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

  const [questions, t] = await Promise.all([
    getVacancyQuestions(vacancy.id),
    getServerDictionary(),
  ]);

  const companyRow = vacancy.organizationId
    ? await getOrganization(vacancy.organizationId)
    : null;
  const companyName = companyRow?.name ?? vacancy.details?.company ?? null;

  const d = vacancy.details;
  const paramRows = vacancyParamRows(d, t);

  const accepting = vacancy.status === "published";
  const n = questions.length;
  const questionsNote = interpolate(
    n === 1 ? t.publicVacancy.questionsNoteOne : t.publicVacancy.questionsNoteMany,
    { count: n },
  );

  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(45%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
      />
      <ViewBeacon slug={slug} />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        {companyRow?.slug ? (
          <Link
            href={`/c/${companyRow.slug}`}
            className="group flex items-center gap-2"
            title={t.publicVacancy.viewCompany}
          >
            {companyRow.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={companyRow.logo}
                alt={companyName ?? ""}
                className="size-7 rounded-md object-cover"
              />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                {(companyName ?? "V").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-base font-semibold tracking-tight">
              {companyName ?? "Vivi"}
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
              {(companyName ?? "V").slice(0, 1).toUpperCase()}
            </span>
            <span className="text-base font-semibold tracking-tight">
              {companyName ?? "Vivi"}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-10 px-6 pb-24 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {vacancy.title}
          </h1>
          <VacancyHighlights rows={paramRows} className="mt-5" />

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
            {accepting ? (
              <>
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
              </>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                  <Archive className="size-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t.publicVacancy.closedTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.publicVacancy.closedText}
                </p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
