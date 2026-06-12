import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { LandingHero } from "@/components/landing-hero";
import { LandingSteps } from "@/components/landing-steps";
import { getSession } from "@/lib/session";
import { getServerDictionary } from "@/lib/i18n/server";

export default async function Home() {
  const session = await getSession();
  const t = await getServerDictionary();
  const isLoggedIn = Boolean(session?.user);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <span className="sr-only">Vivi</span>
        <nav className="flex items-center gap-1.5">
          <ThemeToggle />
          {session?.user ? (
            <Button asChild size="sm" className="ml-1">
              <Link href="/app">
                {t.landing.openApp} <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t.landing.signIn}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login">{t.landing.start}</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pt-28 text-center">
        <h1 className="max-w-4xl text-balance text-6xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          {t.landing.heroTitle1}{" "}
          <span className="bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            {t.landing.heroTitle2}
          </span>
        </h1>
        <p className="mt-6 max-w-lg text-balance text-lg leading-relaxed text-muted-foreground">
          {t.landing.heroSubtitle}
        </p>

        <LandingHero isLoggedIn={isLoggedIn} />

        <div className="mt-24 w-full max-w-5xl pb-24 text-left">
          <h2 className="mb-8 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t.landing.howTitle}
          </h2>
          <LandingSteps
            steps={[
              { title: t.landing.step1Title, text: t.landing.step1Text },
              { title: t.landing.step2Title, text: t.landing.step2Text },
              { title: t.landing.step3Title, text: t.landing.step3Text },
              { title: t.landing.step4Title, text: t.landing.step4Text },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
