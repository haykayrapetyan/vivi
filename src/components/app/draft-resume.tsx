"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { startVacancyFromPrompt } from "@/app/app/actions";
import { DRAFT_COOKIE } from "@/lib/draft";
import { useT } from "@/lib/i18n/client";

/**
 * After a logged-out visitor submits the landing composer and signs in, the
 * draft they typed waits in a cookie. This picks it up on /app, clears it, and
 * resumes vacancy creation so their text is never lost.
 */
export function DraftResume() {
  const t = useT();
  const ranRef = useRef(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const match = document.cookie.match(
      new RegExp(`(?:^|; )${DRAFT_COOKIE}=([^;]*)`),
    );
    if (!match) return;
    document.cookie = `${DRAFT_COOKIE}=; path=/; max-age=0`;

    const draft = decodeURIComponent(match[1]).trim();
    if (!draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResuming(true);
    startVacancyFromPrompt(draft);
  }, []);

  if (!resuming) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{t.appHome.resuming}</p>
    </div>
  );
}
