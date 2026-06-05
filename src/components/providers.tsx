"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/lib/i18n/client";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

export function Providers({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <LocaleProvider locale={locale} dict={dict}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
