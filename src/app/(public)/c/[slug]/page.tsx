import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Briefcase, Building2 } from "lucide-react";
import {
  getCompanyBySlug,
  getPublishedVacanciesByOrg,
} from "@/lib/data";
import { getServerDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/dictionaries";
import { vacancyParamRows } from "@/lib/vacancy-params";
import { VacancyHighlights } from "@/components/vacancy-highlights";
import { Markdown } from "@/components/markdown";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return { title: "Vivi" };
  return {
    title: `${company.name} — careers`,
    description: company.descriptionMd?.slice(0, 160) ?? undefined,
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const [vacancies, t] = await Promise.all([
    getPublishedVacanciesByOrg(company.id),
    getServerDictionary(),
  ]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(45%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
      />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Vivi" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-24">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo}
              alt={company.name}
              className="size-16 rounded-2xl object-cover ring-1 ring-border"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="size-7" />
            </span>
          )}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {company.name}
            </h1>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </div>
        </div>

        {company.descriptionMd && (
          <section className="mb-10">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {interpolate(t.companyPage.aboutTitle, { company: company.name })}
            </h2>
            <Markdown>{company.descriptionMd}</Markdown>
          </section>
        )}

        <section>
          <h2 className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Briefcase className="size-3.5" />
            {t.companyPage.openRolesTitle}
            {vacancies.length > 0 && (
              <span className="text-muted-foreground/70">
                · {vacancies.length}
              </span>
            )}
          </h2>

          {vacancies.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card/30 px-4 py-10 text-center text-sm text-muted-foreground">
              {t.companyPage.noRoles}
            </p>
          ) : (
            <div className="space-y-3">
              {vacancies.map((v) => (
                <Link
                  key={v.id}
                  href={v.publicSlug ? `/v/${v.publicSlug}` : "#"}
                  className="group flex items-center gap-4 rounded-xl border bg-card/50 p-4 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-medium">
                      {v.title}
                    </h3>
                    <div className="mt-2">
                      <VacancyHighlights rows={vacancyParamRows(v.details, t)} />
                    </div>
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
