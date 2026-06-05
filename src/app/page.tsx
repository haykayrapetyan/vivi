import Link from "next/link";
import { ArrowRight, MessagesSquare, Share2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getSession } from "@/lib/session";
import { getServerDictionary } from "@/lib/i18n/server";

export default async function Home() {
  const session = await getSession();
  const t = await getServerDictionary();

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Vivi</span>
        <nav className="flex items-center gap-1.5">
          <LanguageSwitcher />
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pt-20 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-primary" />
          {t.landing.badge}
        </div>

        <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          {t.landing.heroTitle}
        </h1>
        <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground">
          {t.landing.heroSubtitle}
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Button asChild size="lg">
            <Link href={session?.user ? "/app" : "/login"}>
              {t.landing.ctaCreate} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-20 grid w-full max-w-4xl gap-4 pb-24 text-left sm:grid-cols-3">
          <Feature
            icon={<MessagesSquare className="size-5" />}
            title={t.landing.f1Title}
            text={t.landing.f1Text}
          />
          <Feature
            icon={<Share2 className="size-5" />}
            title={t.landing.f2Title}
            text={t.landing.f2Text}
          />
          <Feature
            icon={<Video className="size-5" />}
            title={t.landing.f3Title}
            text={t.landing.f3Text}
          />
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border bg-card/50 p-5">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
