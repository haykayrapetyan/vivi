@AGENTS.md

# Vivi — developer guide

> Keep this file up to date. When you add a feature, route, env var, or hit a
> non-obvious gotcha, update the relevant section here in the same change.

## What Vivi is

A SaaS for recruiters. A recruiter describes a role in a ChatGPT-style chat; an
AI (OpenAI) asks clarifying questions and generates the vacancy description +
tailored video-interview questions. The recruiter publishes the vacancy to get a
public link; candidates apply and record webcam video answers; the recruiter
reviews the videos, rates and shortlists candidates. UI copy is in Russian; the
visual style is minimalist dark, Linear-inspired.

## Commands

- `pnpm dev` — start the dev server (Turbopack) on :3000.
- `pnpm check` — **run before finishing any change**: `tsc --noEmit && eslint && vitest run`.
- `pnpm test` / `pnpm test:watch` — Vitest.
- `pnpm build` — production build.
- `pnpm db:generate` then `pnpm db:migrate` — create + apply a Drizzle migration after editing `src/lib/db/schema.ts`. (`db:push` needs a TTY, so prefer generate+migrate here.)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui
(radix base) · Drizzle ORM + Postgres · better-auth (magic link) · Resend
(email) · Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) ·
react-markdown · Vitest.

## Environment (`.env.local`, see `.env.example`)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`,
`OPENAI_API_KEY`, `OPENAI_MODEL`, `RESEND_API_KEY`, `EMAIL_FROM`,
`STORAGE_DRIVER` (`local`|`r2`), `LOCAL_UPLOAD_DIR`. Local Postgres db is `vivi`.

## Architecture / where things live

- `src/lib/db/schema.ts` — Drizzle schema: better-auth tables (user/session/account/verification) + domain (`vacancy`, `chat_message`, `interview_question`, `candidate`, `interview_answer`).
- `src/lib/db/index.ts` — Drizzle client (postgres-js, reused across HMR).
- `src/lib/data.ts` — read queries (server-only). `src/app/app/actions.ts` + `src/app/v/[slug]/actions.ts` — server actions (writes), each enforcing ownership.
- `src/lib/auth.ts` / `auth-client.ts` / `session.ts` — better-auth server, React client, and `getSession`/`requireUser` helpers. Auth API at `src/app/api/auth/[...all]/route.ts`.
- `src/lib/email.ts` — Resend wrapper. `send()` is exported and tested.
- `src/lib/storage.ts` — video storage abstraction (local disk now; `r2` driver is a TODO). Reads env at call time.
- `src/lib/ai.ts` — the recruiter chat system prompt.
- `src/lib/{slug,format,validation}.ts` — pure helpers (unit-tested).

### Routes / flow

- `/` landing · `/login` magic-link · `/app` dashboard (sidebar = vacancies).
- `/app/v/[id]` — workspace: left chat (`vacancy-chat.tsx` ↔ `POST /api/vacancy/[id]/chat` streaming with a `save_vacancy` tool), right panel (`vacancy-panel.tsx` with "Вакансия"/"Кандидаты" tabs; `candidates-review.tsx`). On <lg the panel is in a Sheet (`vacancy-panel-sheet.tsx`).
- `/v/[slug]` — public vacancy + apply form → `applyToVacancy` creates a candidate, redirects to the interview.
- `/interview/[token]` — candidate records webcam answers (`interview-client.tsx`, MediaRecorder) → `POST /api/interview/[token]/answer` (upload) and `.../complete` (mark done + email recruiter).
- `GET /api/media/answer/[id]` — recruiter-only video streaming (ownership-checked, supports Range).

## Testing

- Vitest, node environment, tests in `tests/**/*.test.ts`, `@/` alias via `vite-tsconfig-paths`.
- `server-only`/`client-only` are aliased to `tests/stubs/empty.ts` (see `vitest.config.ts`) so server modules import under test.
- Current coverage: pure helpers (slug/format/validation), storage round-trip + path-traversal safety, email send (Resend mocked: dev swallows failures, prod throws). DB-touching actions/routes are not yet covered — add integration tests against a disposable DB when expanding.

## Gotchas

- **kysely is pinned to `0.28.17`** in `pnpm-workspace.yaml` overrides. better-auth's kysely-adapter imports migrator constants from kysely's main entry, which 0.29.x dropped — without the pin every auth-importing page 500s.
- **Resend sandbox**: with the `onboarding@resend.dev` sender, Resend only delivers to the account owner (`h@ai9.am`); other recipients 403. In dev, `email.ts` logs the link to the server console and does not throw, so login works with any email. For real delivery, verify a domain and set `EMAIL_FROM`.
- **Radix triggers** (Tabs, DropdownMenu) activate on `mousedown`/pointer events, not `click` — relevant when scripting the browser in tests/preview.
- Don't nest interactive elements: a `<button>` inside a `<button>` breaks hydration and silently kills page interactivity (was the candidate card + star rating bug).
- Video is on local disk under `/uploads` (gitignored), served only through the auth-checked media route — never from `public/`.
