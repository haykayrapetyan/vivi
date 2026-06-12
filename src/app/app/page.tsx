import { MessagesSquare } from "lucide-react";
import { getServerDictionary } from "@/lib/i18n/server";
import { AppHomeCta } from "@/components/app/app-home-cta";
import { DraftResume } from "@/components/app/draft-resume";
import { MobileMenuButton } from "@/components/app/sidebar";

export default async function AppHome() {
  const t = await getServerDictionary();

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
      <MobileMenuButton className="absolute left-2 top-2" />
      <DraftResume />
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MessagesSquare className="size-6" />
      </div>
      <h1 className="text-lg font-medium">{t.appHome.title}</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {t.appHome.subtitle}
      </p>
      <div className="mt-6">
        <AppHomeCta />
      </div>
    </div>
  );
}
