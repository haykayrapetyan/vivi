"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from "./dictionaries";

type LocaleContextValue = { locale: Locale; dict: Dictionary };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, dict }}>
      {children}
    </LocaleContext.Provider>
  );
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT/useLocale must be used within LocaleProvider");
  return ctx;
}

/** Returns the active dictionary, e.g. `const t = useT(); t.panel.publishBtn`. */
export function useT(): Dictionary {
  return useLocaleContext().dict;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}
