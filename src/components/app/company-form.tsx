"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, RefreshCw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  regenerateCompanyDescription,
  updateCompany,
  uploadCompanyLogo,
} from "@/app/app/company-actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";

export type CompanyProfile = {
  name: string;
  website: string | null;
  descriptionMd: string | null;
  logo: string | null;
};

export function CompanyForm({ company }: { company: CompanyProfile }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [website, setWebsite] = useState(company.website ?? "");
  const [description, setDescription] = useState(company.descriptionMd ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [regenerating, startRegen] = useTransition();

  const logoPreview = logoFile
    ? URL.createObjectURL(logoFile)
    : company.logo ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t.validation.companyNameRequired);
      return;
    }
    setNameError(undefined);
    setBusy(true);
    try {
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        await uploadCompanyLogo(fd);
      }
      await updateCompany({ name, website, descriptionMd: description });
      toast.success(t.company.saved);
      setLogoFile(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.company.saveError);
    } finally {
      setBusy(false);
    }
  }

  function regenerate() {
    startRegen(async () => {
      const { ok, description: next } = await regenerateCompanyDescription();
      if (ok && next) {
        setDescription(next);
        router.refresh();
      } else {
        toast.error(t.company.generateError);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="size-full object-cover" />
          ) : (
            <Building2 className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="c-logo"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Upload className="size-3.5" />
            {t.company.logoUpload}
          </Label>
          <input
            id="c-logo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">{t.company.logoHint}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-name">{t.company.nameLabel}</Label>
        <Input
          id="c-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(undefined);
          }}
          placeholder={t.company.namePlaceholder}
          aria-invalid={!!nameError}
        />
        <FieldError>{nameError}</FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-site">{t.company.websiteLabel}</Label>
        <Input
          id="c-site"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t.company.websitePlaceholder}
        />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3 text-primary" />
          {t.company.websiteHint}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="c-desc">{t.company.descriptionLabel}</Label>
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
          id="c-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={10}
          placeholder={t.company.descriptionPlaceholder}
          className="text-sm"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {t.common.save}
        </Button>
      </div>
    </form>
  );
}
