// "How it works" on the landing — large product-like cards (2 per row), each
// with a realistic UI mockup built from the app's design tokens and real
// content (real portrait photos for candidates). The visual accent is the big
// card heading; the mockups stay calm so they read as a real product surface,
// not loud call-to-action blocks.

type Step = { title: string; text: string };

export function LandingSteps({ steps }: { steps: Step[] }) {
  const mockups = [MockChat, MockShare, MockScreen, MockShortlist];
  return (
    <div className="grid w-full gap-6 sm:grid-cols-2">
      {steps.map((s, i) => {
        const Mock = mockups[i] ?? MockChat;
        return (
          <div
            key={s.title}
            className="group flex flex-col overflow-hidden rounded-2xl border bg-card/40 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_16px_50px_-20px_rgba(0,0,0,0.5)]"
          >
            <div className="relative h-52 overflow-hidden border-b bg-muted/20 p-6 sm:p-7">
              <div className="relative h-full">
                <Mock />
              </div>
            </div>
            <div className="p-5">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="text-sm font-semibold tabular-nums text-muted-foreground/70">
                  0{i + 1}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">
                  {s.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {s.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ portraits ----------------------------- */

type Person = "maria" | "sarah" | "john";

function Portrait({ who, className = "size-8" }: { who: Person; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/landing/${who}.jpg`}
      alt=""
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  );
}

/* ----------------------------- mockups -------------------------------- */

// 1. Describe the role — a mini Vivi chat building the vacancy. Quiet bubbles.
function MockChat() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 text-left">
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-foreground/[0.07] px-3.5 py-2 text-xs font-medium leading-snug">
        Senior Frontend Engineer, React, remote
      </div>
      <div className="mr-auto max-w-[88%] rounded-2xl rounded-bl-md border bg-background px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Done — draft and 5 interview questions are ready. What&apos;s the salary
        range you have in mind?
      </div>
      <div className="mr-auto flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-emerald-500" strokeWidth="2">
          <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Vacancy draft updated
      </div>
    </div>
  );
}

// 2. Share one link — the public vacancy card candidates see.
function MockShare() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        <span className="truncate text-xs text-muted-foreground">
          vivi.app/v/senior-frontend
        </span>
        <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Copy
        </span>
      </div>
      <div className="rounded-xl border bg-background p-3.5 text-left">
        <div className="text-sm font-semibold leading-tight">
          Senior Frontend Engineer
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          Remote · Full-time · $140–180k
        </div>
        <div className="mt-3 flex h-8 w-full items-center justify-center rounded-lg border border-foreground/15 bg-foreground/[0.04] text-[11px] font-medium">
          Apply & record video interview
        </div>
      </div>
    </div>
  );
}

// 3. Vivi screens everyone — evaluated candidates with AI scores.
function MockScreen() {
  const rows: { who: Person; name: string; note: string; s: number }[] = [
    { who: "maria", name: "Maria Lopez", note: "Strong React depth, led a 6-person team", s: 9 },
    { who: "john", name: "John Carter", note: "Solid, but no production TypeScript", s: 7 },
    { who: "sarah", name: "Sarah Kim", note: "Great communicator, shipped design systems", s: 8 },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2 text-left">
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex items-center gap-2.5 rounded-xl border bg-background px-3 py-2"
        >
          <Portrait who={r.who} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium leading-tight">
              {r.name}
            </span>
            <span className="block truncate text-[10px] leading-tight text-muted-foreground">
              {r.note}
            </span>
          </span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 text-[10px] font-bold text-primary">
            {r.s}
          </span>
        </div>
      ))}
    </div>
  );
}

// 4. You pick from the best — a ranked shortlist with the agent's take.
function MockShortlist() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 text-left">
      <div className="rounded-xl border bg-background px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-[10px] font-bold text-foreground">
            1
          </span>
          <Portrait who="maria" className="size-7" />
          <span className="truncate text-xs font-semibold">Maria Lopez</span>
          <span className="ml-auto rounded-full border border-primary/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
            Top pick
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          &ldquo;I&apos;d move fast on Maria — her migration story is exactly
          your roadmap.&rdquo;
        </p>
      </div>
      {(
        [
          { rank: 2, who: "sarah", name: "Sarah Kim" },
          { rank: 3, who: "john", name: "John Carter" },
        ] as { rank: number; who: Person; name: string }[]
      ).map((r) => (
        <div
          key={r.rank}
          className="flex items-center gap-2.5 rounded-xl border bg-background px-3 py-2"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {r.rank}
          </span>
          <Portrait who={r.who} className="size-7" />
          <span className="truncate text-xs font-medium">{r.name}</span>
        </div>
      ))}
    </div>
  );
}
