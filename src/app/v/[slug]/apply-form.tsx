"use client";

import { useState, useTransition } from "react";
import { Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { applyToVacancy } from "./actions";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApplyForm({ slug }: { slug: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
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
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t.apply.nameLabel}</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t.apply.namePlaceholder}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t.apply.emailLabel}</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={t.apply.emailPlaceholder}
          required
        />
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
