"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/lib/i18n/client";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

/* ------------------------------- theme --------------------------------- */
// A tiny theme implementation (no next-themes) so we can keep independent
// themes per area without rendering an inline <script> inside a client
// component (which React 19 warns about). The no-flash init script lives in
// the server-rendered <head> (see app/layout.tsx).

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  resolvedTheme: Theme;
  setTheme: (t: Theme) => void;
} | null>(null);

function readStored(storageKey: string): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return localStorage.getItem(storageKey) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyClass(theme: Theme) {
  const cl = document.documentElement.classList;
  cl.remove("light", "dark");
  cl.add(theme);
}

/** Theme boundary with its own storage key, so toggling in one area (e.g. the
 * admin dashboard) does not change the theme of another (e.g. public vacancy).
 * When `initialTheme` is given (logged-in area: the value saved in the user's
 * profile) it wins over localStorage; `onPersist` is called on every change so
 * the choice can be saved back to the profile. */
export function ThemeArea({
  storageKey,
  initialTheme,
  onPersist,
  children,
}: {
  storageKey: string;
  initialTheme?: Theme | null;
  onPersist?: (t: Theme) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => initialTheme ?? readStored(storageKey),
  );

  // Keep <html> in sync on mount (handles SPA navigation between areas) and
  // whenever the theme changes; mirror into localStorage so the no-flash
  // <head> script agrees with the profile on the next load.
  useEffect(() => {
    applyClass(theme);
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // ignore storage failures
    }
  }, [theme, storageKey]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      try {
        localStorage.setItem(storageKey, t);
      } catch {
        // ignore storage failures
      }
      applyClass(t);
      void onPersist?.(t);
    },
    [storageKey, onPersist],
  );

  return (
    <ThemeContext.Provider value={{ resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return (
    useContext(ThemeContext) ?? {
      resolvedTheme: "dark" as Theme,
      setTheme: () => {},
    }
  );
}

/* ----------------------------- global providers ------------------------- */

/** Global providers (locale + tooltips). Theme is provided per area. */
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
    <LocaleProvider locale={locale} dict={dict}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </LocaleProvider>
  );
}
