"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { setupCompany, uploadCompanyLogo } from "@/app/app/company-actions";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { buildPublicSlug } from "@/lib/slug";
import type { CompanyProfile } from "@/components/app/company-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Org = { id: string; name: string; role: string };

/** Company icon: a direct logo URL if we have one, else the public media
 * route (works for uploaded logos), else a letter tile. */
function CompanyIcon({
  org,
  logoUrl,
  className = "size-5 text-[10px] rounded",
}: {
  org: { id: string; name: string };
  logoUrl?: string | null;
  className?: string;
}) {
  // 0 = direct url, 1 = media route, 2 = letter fallback
  const [step, setStep] = useState(logoUrl ? 0 : 1);
  const src = step === 0 ? logoUrl! : `/api/media/logo/${org.id}`;

  if (step < 2) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setStep((s) => s + 1)}
        className={cn("shrink-0 bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary/15 font-semibold text-primary",
        className,
      )}
    >
      {org.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function OrgSwitcher({
  organizations,
  activeOrganizationId,
  activeCompany,
}: {
  organizations: Org[];
  activeOrganizationId: string;
  activeCompany: CompanyProfile;
}) {
  const t = useT();
  const router = useRouter();
  const [, startSwitch] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const active =
    organizations.find((o) => o.id === activeOrganizationId) ??
    organizations[0];

  function switchOrg(id: string) {
    if (id === activeOrganizationId) return;
    startSwitch(async () => {
      await authClient.organization.setActive({ organizationId: id });
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60">
            {active && (
              <CompanyIcon
                org={active}
                logoUrl={activeCompany.logo}
                className="size-7 rounded-md text-xs"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
              {active?.name}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          {organizations.map((o) => (
            <DropdownMenuItem key={o.id} onSelect={() => switchOrg(o.id)}>
              <CompanyIcon org={o} />
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              {o.id === activeOrganizationId && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus className="size-4" /> {t.team.createCompany}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function CreateCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t.validation.companyNameRequired);
      return;
    }
    setNameError(undefined);
    setBusy(true);
    const { data, error } = await authClient.organization.create({
      name: name.trim(),
      slug: buildPublicSlug(name),
    });
    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? t.company.saveError);
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    if (logoFile) {
      const fd = new FormData();
      fd.append("file", logoFile);
      try {
        await uploadCompanyLogo(fd);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.company.saveError);
      }
    }
    // Store the website + generate the description; when no logo was uploaded
    // it also tries to discover one on the site (best-effort).
    await setupCompany(website.trim() || null);
    setBusy(false);
    setName("");
    setWebsite("");
    setLogoFile(null);
    onOpenChange(false);
    toast.success(t.company.created);
    router.push("/app");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.company.newCompany}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="c-new-name">{t.company.nameLabel}</Label>
            <Input
              id="c-new-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(undefined);
              }}
              placeholder={t.company.namePlaceholder}
              autoFocus
              aria-invalid={!!nameError}
            />
            <FieldError>{nameError}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-new-site">{t.company.websiteLabel}</Label>
            <Input
              id="c-new-site"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t.company.websitePlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              {t.company.websiteHint}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-new-logo">{t.company.logoLabel}</Label>
            <div className="flex items-center gap-3">
              {logoFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={URL.createObjectURL(logoFile)}
                  alt=""
                  className="size-9 shrink-0 rounded-md object-cover ring-1 ring-border"
                />
              )}
              <Input
                id="c-new-logo"
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t.company.logoHint}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? t.company.studying : t.company.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

