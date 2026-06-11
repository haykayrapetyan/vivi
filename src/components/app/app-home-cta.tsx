"use client";

import { useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createVacancy } from "@/app/app/actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export function AppHomeCta() {
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button disabled={pending} onClick={() => start(() => createVacancy())}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      {t.sidebar.newVacancy}
    </Button>
  );
}
