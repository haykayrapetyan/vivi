"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { updateCompany, uploadCompanyLogo } from "@/app/app/company-actions";
import { downscaleImage } from "@/lib/image-resize";
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
  slug: string | null;
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Mirror of slugify() for live preview — keep in sync with lib/slug.ts. */
function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function CompanyForm({ company }: { company: CompanyProfile }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [website, setWebsite] = useState(company.website ?? "");
  const [description, setDescription] = useState(company.descriptionMd ?? "");
  const [slug, setSlug] = useState(company.slug ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  const logoPreview = logoFile
    ? URL.createObjectURL(logoFile)
    : company.logo ?? null;
  const slugPreview = toSlug(slug);

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
        const logo = await downscaleImage(logoFile);
        const fd = new FormData();
        fd.append("file", logo, "logo.webp");
        await uploadCompanyLogo(fd);
      }
      await updateCompany({
        name,
        website,
        descriptionMd: description,
        slug: slugPreview || undefined,
      });
      toast.success(t.company.saved);
      setLogoFile(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.company.saveError);
    } finally {
      setBusy(false);
    }
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
        <Label htmlFor="c-desc">{t.company.descriptionLabel}</Label>
        <Textarea
          id="c-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={t.company.descriptionPlaceholder}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {t.company.descriptionHint}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-slug">{t.company.pageUrlLabel}</Label>
        <div className="flex items-center rounded-lg border bg-card focus-within:border-primary/50">
          <span className="shrink-0 border-r px-2.5 py-2 text-xs text-muted-foreground">
            {(appUrl || "").replace(/^https?:\/\//, "")}/c/
          </span>
          <input
            id="c-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme"
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t.company.pageUrlHint}
        </p>
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
