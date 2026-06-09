"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  createCompany,
  regenerateCompanyDescription,
  updateCompany,
} from "@/app/app/company-actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CompanyData = {
  id: string;
  name: string;
  website: string | null;
  descriptionMd: string | null;
};

export function CompanyDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company?: CompanyData;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {/* Remounts on open (DialogContent unmounts when closed), so the form
            state initializes fresh from props without a setState-in-effect. */}
        <CompanyForm company={company} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CompanyForm({
  company,
  onClose,
}: {
  company?: CompanyData;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const isEdit = Boolean(company);

  const [name, setName] = useState(company?.name ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [description, setDescription] = useState(company?.descriptionMd ?? "");
  const [busy, setBusy] = useState(false);
  const [regenerating, startRegen] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (isEdit && company) {
        await updateCompany(company.id, {
          name,
          website,
          descriptionMd: description,
        });
        toast.success(t.panel.savedToast);
      } else {
        await createCompany(name, website || null);
        toast.success(t.company.created);
      }
      router.refresh();
      onClose();
    } catch {
      toast.error(t.panel.saveError);
    } finally {
      setBusy(false);
    }
  }

  function regenerate() {
    if (!company) return;
    startRegen(async () => {
      const { ok, description: next } = await regenerateCompanyDescription(
        company.id,
      );
      if (ok && next) {
        setDescription(next);
        router.refresh();
      } else {
        toast.error(t.company.generateError);
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? t.company.edit : t.company.newCompany}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="company-name">{t.company.nameLabel}</Label>
          <Input
            id="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.company.namePlaceholder}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="company-site">{t.company.websiteLabel}</Label>
          <Input
            id="company-site"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={t.company.websitePlaceholder}
          />
          {!isEdit && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              {t.company.websiteHint}
            </p>
          )}
        </div>

        {isEdit && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="company-desc">{t.company.descriptionLabel}</Label>
              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {regenerating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                {regenerating ? t.company.studying : t.company.regenerate}
              </button>
            </div>
            <Textarea
              id="company-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              placeholder={t.company.descriptionPlaceholder}
              className="text-sm"
            />
          </div>
        )}

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
            {busy && !isEdit
              ? t.company.studying
              : isEdit
                ? t.common.save
                : t.company.create}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
