import { MessagesSquare } from "lucide-react";
import { createVacancy } from "./actions";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";

export default async function AppHome() {
  const t = await getServerDictionary();
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MessagesSquare className="size-6" />
      </div>
      <h1 className="text-lg font-medium">{t.appHome.title}</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {t.appHome.subtitle}
      </p>
      <form action={createVacancy} className="mt-6">
        <Button type="submit">{t.sidebar.newVacancy}</Button>
      </form>
    </div>
  );
}
