"use client";

import { useState, useTransition } from "react";
import { Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { applyToVacancy } from "./actions";
import { useT } from "@/lib/i18n/client";
import { isEmail } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

export function ApplyForm({ slug }: { slug: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: { name?: string; email?: string } = {};
    if (!form.name.trim()) next.name = t.validation.nameRequired;
    if (!form.email.trim()) next.email = t.validation.emailRequired;
    else if (!isEmail(form.email)) next.email = t.validation.emailInvalid;
    setErrors(next);
    if (next.name || next.email) return;

    start(async () => {
      try {
        await applyToVacancy(slug, form);
      } catch (err) {
        // redirect() throws internally — ignore that, surface real errors.
        if (
          err instanceof Error &&
          !err.message.includes("NEXT_REDIRECT")
        ) {
          toast.error(err.message);
        }
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">{t.apply.nameLabel}</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => {
            setForm({ ...form, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: undefined });
          }}
          placeholder={t.apply.namePlaceholder}
          aria-invalid={!!errors.name}
        />
        <FieldError>{errors.name}</FieldError>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t.apply.emailLabel}</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => {
            setForm({ ...form, email: e.target.value });
            if (errors.email) setErrors({ ...errors, email: undefined });
          }}
          placeholder={t.apply.emailPlaceholder}
          aria-invalid={!!errors.email}
        />
        <FieldError>{errors.email}</FieldError>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">
          {t.apply.phoneLabel}{" "}
          <span className="text-muted-foreground">({t.apply.optional})</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder={t.apply.phonePlaceholder}
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Video className="size-4" />
        )}
        {t.apply.submit}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t.apply.note}
      </p>
    </form>
  );
}
