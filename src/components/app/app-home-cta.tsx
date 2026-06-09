"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createVacancy } from "@/app/app/actions";
import { CompanyDialog } from "@/components/app/company-dialog";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export function AppHomeCta({
  firstCompanyId,
}: {
  firstCompanyId: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (firstCompanyId) {
    return (
      <Button
        disabled={pending}
        onClick={() => start(() => createVacancy(firstCompanyId))}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {t.sidebar.newVacancy}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t.company.add}
      </Button>
      <CompanyDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
