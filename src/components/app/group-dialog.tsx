"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createGroup, renameGroup } from "@/app/app/group-actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GroupDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group?: { id: string; name: string };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <GroupForm group={group} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function GroupForm({
  group,
  onClose,
}: {
  group?: { id: string; name: string };
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const isEdit = Boolean(group);
  const [name, setName] = useState(group?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.validation.groupNameRequired);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      if (isEdit && group) {
        await renameGroup(group.id, name);
      } else {
        await createGroup(name);
      }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? t.group.rename : t.group.newGroup}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="g-name">{t.group.nameLabel}</Label>
          <Input
            id="g-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(undefined);
            }}
            placeholder={t.group.namePlaceholder}
            autoFocus
            aria-invalid={!!error}
          />
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? t.common.save : t.common.add}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
