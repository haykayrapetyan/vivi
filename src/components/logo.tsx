import { cn } from "@/lib/utils";

/**
 * The Vivi brand mark: two people (dots) forming a V, with the blue→magenta
 * gradient. Pure SVG so it stays crisp and works on any background.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="vivi-dot-l" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#4361ee" />
        </linearGradient>
        <linearGradient id="vivi-dot-r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d048e6" />
          <stop offset="1" stopColor="#b327d4" />
        </linearGradient>
        <linearGradient id="vivi-v" x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0" stopColor="#4f7cf6" />
          <stop offset="0.5" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#d048e6" />
        </linearGradient>
      </defs>
      {/* the V — two overlapping rounded ribbons */}
      <path
        d="M26 40 L50 82"
        fill="none"
        stroke="url(#vivi-v)"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M74 40 L50 82"
        fill="none"
        stroke="url(#vivi-v)"
        strokeWidth="20"
        strokeLinecap="round"
        opacity="0.92"
      />
      {/* the two heads */}
      <circle cx="28" cy="22" r="12" fill="url(#vivi-dot-l)" />
      <circle cx="72" cy="22" r="12" fill="url(#vivi-dot-r)" />
    </svg>
  );
}

/**
 * Full logo lockup (mark + "vivi" wordmark) — the official brand PNGs, swapped
 * by theme via CSS (the dark-ink version on light backgrounds, the white
 * version on dark). No JS, no flash. `h-7` default; pass a height class.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* light theme → "white" file (dark-ink wordmark) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/vivi-white.png"
        alt="Vivi"
        className="h-7 w-auto dark:hidden"
      />
      {/* dark theme → "dark" file (white wordmark) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/vivi-dark.png"
        alt=""
        aria-hidden
        className="hidden h-7 w-auto dark:block"
      />
    </span>
  );
}
