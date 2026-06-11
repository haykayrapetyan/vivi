"use client";

import { useEffect, useRef } from "react";

/** Records one vacancy view per browser session (fire-and-forget). */
export function ViewBeacon({ slug }: { slug: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const key = `vivi_viewed_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable — still count the view.
    }
    fetch(`/api/v/${slug}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);
  return null;
}
