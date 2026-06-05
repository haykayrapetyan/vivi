"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocale } from "@/lib/i18n/client";
import { setLocale } from "@/lib/i18n/actions";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "ru" ? "en" : "ru";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      disabled={pending}
      aria-label="Сменить язык"
      onClick={() =>
        start(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
    >
      <Languages className="size-4" />
      {locale.toUpperCase()}
    </Button>
  );
}
