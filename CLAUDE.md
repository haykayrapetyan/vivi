@AGENTS.md

# Vivi — developer guide

> Keep this file up to date. When you add a feature, route, env var, or hit a
> non-obvious gotcha, update the relevant section here in the same change.

## What Vivi is

A SaaS for recruiters. A recruiter describes a role in a ChatGPT-style chat; an
AI (OpenAI) asks clarifying questions and generates the vacancy description +
tailored video-interview questions. The recruiter publishes the vacancy to get a
public link; candidates apply and record webcam video answers; the AI
transcribes + scores the answers; the recruiter reviews videos/transcripts,
rates and shortlists candidates. Each vacancy has an **autonomous recruiter
agent** living in the same vacancy chat: it wakes on events (candidate
completed an interview), screens the candidate, posts its analysis into the
chat as an "Agent update" and emails the recruiter. **A workspace/organization
IS a Company**
(one company per workspace, with name/website/AI-description/logo); members
collaborate, and vacancies can be optionally organized into name-only **Groups**.
The product is **English-only** (US market) — no Russian anywhere in UI, code,
comments, or AI prompts. Visual style: minimalist dark, Linear-inspired.

## Commands

- `pnpm dev` — start the dev server (Turbopack) on :3000.
- `pnpm dev:agent` — the Cloudflare agent worker locally (`wrangler dev` on :8787, Durable Objects emulated). Without it, candidate screening falls back to inline execution after the response; the kickoff message and the cron heartbeat need the worker.
- `pnpm check:agent` — `tsc --noEmit` for `agent-worker/` (excluded from the root tsconfig).
- `pnpm check` — **run before finishing any change**: `tsc --noEmit && eslint && vitest run`.
- `pnpm test` / `pnpm test:watch` — Vitest.
- `pnpm build` — production build.
- `pnpm db:generate` then `pnpm db:migrate` — create + apply a Drizzle migration after editing `src/lib/db/schema.ts`. (`db:push` needs a TTY, so prefer generate+migrate here.)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui
(radix base) · Drizzle ORM + Postgres · better-auth (magic link) · Resend
(email) · Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) ·
Cloudflare Agents SDK (`agents`, Durable Objects — the per-vacancy agent
worker in `agent-worker/`) · react-markdown · Vitest. UI is English-only.

## Theme & i18n

- **Theme**: a tiny **custom** implementation (no `next-themes` — it renders an inline `<script>` that React 19 flags). `ThemeArea` (`providers.tsx`) is a context with its own `storageKey`, **per-area**: `/app` layout uses `vivi-app`, the `(public)` route group layout uses `vivi-public`, so toggling in the dashboard does **not** change the public vacancy/interview theme. A no-flash init script in the root `<head>` (`app/layout.tsx`, picks the key by path) sets the `light`/`dark` class before paint; `ThemeArea`'s effect re-applies it on SPA navigation. `useTheme()`/`ThemeToggle` consume it. Tokens in `globals.css` (`:root` = light, `.dark` = dark); only `light`/`dark` (no "system"). For logged-in users the choice is **persisted in the profile** (`user.theme` column): the `/app` layout reads it (`getUserTheme`) and passes `initialTheme` + the `updateUserTheme` server action to `ThemeArea` (`onPersist`), so it follows the user across devices; localStorage stays only as the no-flash cache. The toggle lives in the sidebar **user menu** (public pages keep `ThemeToggle`).
- **Strings**: English-only, kept in a single dictionary `src/lib/i18n/dictionaries.ts` (`en`). Server: `getServerDictionary()` (`i18n/server.ts`). Client: `useT()` (`i18n/client.tsx`) — `t.section.key`. Dynamic strings use `{placeholders}` + `interpolate()`. There is no language switcher or locale cookie. The dictionary mechanism is kept only to centralize copy — **all new UI copy must be in English**.

## Environment (`.env.local`, see `.env.example`)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`,
`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TRANSCRIBE_MODEL` (default `whisper-1`),
`RESEND_API_KEY`, `EMAIL_FROM`, and Cloudflare R2 (the only video backend):
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
`AGENT_WORKER_URL` (http://localhost:8787 in dev) + `AGENT_GATEWAY_SECRET` —
the Cloudflare agent worker; the same secret also goes into
`agent-worker/.dev.vars` (see `.dev.vars.example`) along with `APP_BASE_URL`
and `OPENAI_API_KEY`. Local Postgres db is `vivi`. Secrets go in `.env.local`
(gitignored).

## Architecture / where things live

- `src/lib/db/schema.ts` — Drizzle schema: better-auth tables (user/session/account/verification + `organization`/`member`/`invitation`) + domain. **The `organization` IS the company** — it carries `name`/`website`/`descriptionMd`/`logo`. A **group** is an optional name-only grouping; to avoid a destructive rename it is the Drizzle export `group` mapping to the existing DB table `"company"`, and `vacancy.groupId` is the Drizzle alias of the existing DB column `"company_id"` (nullable). Plus `chat_message`, `interview_question`, `candidate` (has `ai_score`/`ai_evaluation`/`ai_evaluated_at`), `interview_answer` (has `transcript`).
- `src/lib/db/index.ts` — Drizzle client (postgres-js, reused across HMR).
- `src/lib/data.ts` — read queries (server-only). `src/app/app/actions.ts` + `src/app/v/[slug]/actions.ts` — server actions (writes). **Access is org-membership based**: `getOwnedVacancy(id, userId)` checks the user is a member of the vacancy's org; same pattern in actions + the media route.
- `src/lib/auth.ts` / `auth-client.ts` / `session.ts` — better-auth (magic link + **organization plugin**). `requireUser`, `getActiveOrganizationId`, `requireUserAndOrg` helpers. A `databaseHooks` auto-creates a personal org (owner) for every new user and sets the session's active org. Auth API at `src/app/api/auth/[...all]/route.ts`.
- `src/lib/email.ts` — Resend wrapper. `send()` is exported and tested. Also magic-link, interview-completed, org-invitation templates.
- `src/lib/storage.ts` — object storage on **Cloudflare R2 only** (S3-compatible via `@aws-sdk/client-s3`; lazy client reading env at call time). Generic `saveObject` + `saveVideo`/`readVideo`/`videoSize`/`getReadUrl`; `getReadUrl()` returns a signed GET URL the media routes 302-redirect to. `sanitizeKey()` guards object keys. **Company logos** live at `logos/{orgId}`: uploaded via the `uploadCompanyLogo` action (multipart, ≤2 MB, `image/*`) or auto-discovered from the company website by `src/lib/logo.ts` (apple-touch-icon → `rel=icon` → `/favicon.ico`) during `setupCompany`; served publicly by `GET /api/media/logo/[orgId]`.
- `src/lib/safe-fetch.ts` — `safeFetch()`, the **SSRF-guarded fetch for user-supplied URLs** (company website, logo): http(s) only, blocks localhost/private/link-local/metadata ranges (checks literal IPs AND DNS-resolved addresses, IPv4+IPv6), `redirect: "manual"` with every hop re-validated, 12s timeout. Use it for ANY server-side fetch of a URL a user can influence.
- `src/lib/ai.ts` — recruiter chat system prompt. `src/lib/ai-eval.ts` — `transcribeBuffer()` (Whisper) + `evaluateCandidate()` (generateObject → summary/score/strengths/concerns). `src/lib/company-ai.ts` — `generateCompanyDescription()` fetches the company website (http(s) only, blocks private hosts, 12s timeout), strips HTML, summarizes with GPT. All best-effort (no-op without `OPENAI_API_KEY`).
- **The per-vacancy autonomous recruiter agent** is split brain/hands:
  - `agent-worker/` — the **brain**: a separate Cloudflare Worker (Agents SDK, `agents` pkg) with the `VacancyAgent` Durable Object — ONE instance per vacancy (instance name = vacancyId; DOs are single-threaded, so events per vacancy serialize for free). Events: `onCandidateCompleted` (evaluate via gateway → LLM screening → post chat message → email), `onPublished` (one-time kickoff intro + ensures the cron heartbeat). `heartbeat()` runs by DO-alarm cron (weekdays 14:00 UTC): periodic pool review with `list_candidates`/`get_candidate` tools, stuck-candidate flags, and a **quiet rule** — the model answers `NO_UPDATE` to stay silent. Idempotency ledger + `lastReviewAt` live in DO state (`this.setState`); schedules via `this.schedule(cron, "heartbeat", undefined, { idempotent: true })`. Entry `src/index.ts` exposes `POST /event` (bearer `AGENT_GATEWAY_SECRET`) + `/health`.
  - `src/app/api/agent-gateway/[...path]/route.ts` — the **hands**: internal API the worker calls back into (same bearer secret, timing-safe compare): `vacancy/:id/context`, `vacancy/:id/candidate/:cid` (+`/evaluate` → Whisper+eval app-side), `vacancy/:id/message` (post `source='auto'`), `vacancy/:id/notify` (email). The worker never touches Postgres/R2/Resend directly.
  - `src/lib/agent/` — shared + app-side pieces. **Pure, shared with the worker** (relative imports only, no `@/` alias, no server-only): `prompt.ts` (ONE system prompt for interactive chat AND autonomous runs + screening/cycle prompt builders + `NO_UPDATE`), `sanitize.ts` (`cleanUntrusted`/`untrustedBlock` fence candidate text in `<candidate_data>` tags), `stuck.ts` (stalled-candidate detection), `keys.ts` (idempotency keys), `gateway-types.ts` (wire types). **App-only**: `tools.ts` (chat-route tools: transactional `save_vacancy`, `list_candidates`, `get_candidate`), `dispatch.ts` (`dispatchAgentEvent` → worker `/event`, false when unreachable), `run.ts` (`runCandidateCompleted` — the **inline fallback** when the worker is down, PG agent_task idempotency), `store.ts` (DB ops incl. `ensureVacancyAgent`). **There is no on/off toggle** — the agent is intrinsic to a vacancy; its activity follows the vacancy lifecycle (only published is live). `vacancy_agent.enabled` stays as a DB-level emergency stop only.
- `src/app/app/company-actions.ts` — the **company (active org) profile**: `updateCompany`, `regenerateCompanyDescription`, `setupCompany` (called right after a new company/org is created client-side). `src/app/app/group-actions.ts` — `createGroup`/`renameGroup`/`deleteGroup` (name-only). `createVacancy(groupId?)` in `actions.ts` — group optional. The chat route injects the org's `descriptionMd` into the system prompt.
- `src/components/app/team.tsx` — **company switcher** (`OrgSwitcher`): switch company, "Company settings" (opens `company-dialog.tsx` `CompanyProfileDialog` — name/website/logo/AI description), "Members & invites", "Create company" (`authClient.organization.create` + `setupCompany`). `src/components/app/group-dialog.tsx` — create/rename a group (name only).
- `src/lib/{slug,format,validation}.ts` — pure helpers (unit-tested).

### Routes / flow

- Routes split into the `(public)` group (landing `/`, `/login`, `/v`, `/interview`, `/accept-invitation` — own theme) and `/app` (dashboard — own theme). The `(public)`/`(app)` group names don't change URLs.
- **Landing composer → instant vacancy** (`landing-hero.tsx`): the hero is an inline textarea (lovable-style), not just a CTA. On submit, logged-in users hit the `startVacancyFromPrompt` action (auto-creates a default company for brand-new users, then a vacancy) and are redirected to `/app/v/[id]?prompt=…`; `VacancyChat` auto-sends that `initialPrompt` once on mount so the AI starts immediately, then strips the query. Logged-out users get their text stashed in the `vivi_draft` cookie (`src/lib/draft.ts`, 30-min, client-set, non-httpOnly so it survives the magic-link round-trip) and are sent to `/login` (which shows a "draft saved" banner). After login, `DraftResume` (mounted on `/app`) reads + clears the cookie and resumes via the same action — so the typed text is never lost. Cookie pickup is same-device only (magic link opened elsewhere drops the draft).
- `/app` dashboard: the sidebar **header is the company switcher** (logo/letter + company name + chevron; dropdown = switch company / create company — there is no "Vivi" brand row). Below it, "New vacancy" (ungrouped) + "Add group", then **ungrouped vacancies followed by collapsible groups** (`sidebar.tsx`; group children are indented with NO connector line — deliberate). The bottom **user menu** (avatar via `UserAvatar` + email) links to: Profile settings (`/app/settings`), Company settings (`/app/settings/company`), Members & invites (`/app/settings/members`), plus an inline theme toggle and Sign out. Vacancies never require a group. **A vacancy can be moved between groups two ways** — native HTML5 **drag-and-drop** (drag a `VacancyRow` onto a `GroupSection`, or onto the ungrouped `DropZone` to remove it from its group; drop targets highlight while dragging) or the **group `Select`** in the rename dialog. Both call the `moveVacancyToGroup(id, groupId|null)` action (validates the target group is in the vacancy's company). The vacancy id rides in `dataTransfer` under `application/x-vivi-vacancy`; the inner `<Link>` is `draggable={false}` so the row drags, not the href. **All destructive actions go through `ConfirmDialog`** (vacancy delete, group delete, invite cancel — never a bare click, never `window.confirm`). **Responsive**: `sidebar.tsx` exports `AppSidebar` (desktop, `hidden md:flex`) and `MobileNav` (a `md:hidden` top bar whose hamburger opens the same `SidebarBody` in a left `Sheet`, auto-closing on route change). The vacancy panel is a `Sheet` on `<lg`.
- `/app/settings/*` — a **settings section** (`settings/layout.tsx` + `settings-nav.tsx` tabs), all pages not dialogs: **Profile** (`/app/settings`, `settings-form.tsx` — display name + avatar upload), **Company** (`/app/settings/company`, `company-form.tsx` — name/website/logo/AI description), **Members** (`/app/settings/members`, `members-manager.tsx` — invite + member list). Company creation is still a dialog in the switcher (`team.tsx` `CreateCompanyDialog`). **Avatars**: `uploadUserAvatar` (`user-actions.ts`) stores `avatars/{userId}` in R2 and points `user.image` at `GET /api/media/logo`-style public route `/api/media/avatar/[userId]`; the shared `UserAvatar` (`<AvatarImage>` + initials fallback) renders the user everywhere (sidebar, members list, vacancy owner).
- `/app/v/[id]` — workspace: left chat (`vacancy-chat.tsx` ↔ `POST /api/vacancy/[id]/chat` streaming with the shared agent tools: `save_vacancy`, `list_candidates`, `get_candidate` — so the recruiter can ask about candidates right in the chat), right panel (`vacancy-panel.tsx` with Vacancy/Candidates tabs). The chat **polls** `GET /api/vacancy/[id]/chat/messages?after=…` every 5s (skipped while streaming/hidden) and merges `source='auto'` messages via `setMessages` — `useChat`'s `messages` option is initial-only, so a server refresh alone would never show them; auto messages render with an "Agent update" badge. The composer has a **voice input** mic (`voice-input-button.tsx` → `POST /api/voice/transcribe`, MediaRecorder → Whisper; transcript appended to the input) — same button on the landing composer for logged-in users. The Vacancy tab description and questions are editable inline (`updateVacancyDescription` + `replaceQuestions` actions). `candidates-review.tsx` is a list → detail view: filter by status + sort, and a single video player with a question playlist (click/autoplay-next) instead of stacked players. On <lg the panel is in a Sheet (`vacancy-panel-sheet.tsx`).
- `/v/[slug]` — public vacancy (shows company name + an "About the company" section from the company's `descriptionMd`) + apply form → `applyToVacancy` creates a candidate, redirects to the interview.
- `/interview/[token]` — candidate records webcam answers (`interview-client.tsx`, MediaRecorder; client retries upload on transient failure). `POST /api/interview/[token]/answer` saves + transcribes the clip; `.../complete` marks done and hands off to the agent inside `after()` from `next/server` (instant response for the candidate): dispatch to the Cloudflare worker, or — when it's unreachable — run the inline fallback. The agent run evaluates, posts the screening analysis to the vacancy chat and emails the recruiter (agent-review email when analysis was posted, the legacy completed-interview email when the agent is off or there's no `OPENAI_API_KEY`).
- `/accept-invitation/[id]` — invited user accepts an org invitation (must be logged in).
- `GET /api/media/answer/[id]` — org-member-only; 302-redirects to a short-lived signed R2 URL.
- `GET /api/media/logo/[orgId]` — public (logos appear on public vacancy pages); 302-redirects to a signed R2 URL for `logos/{orgId}`, 404 when none stored.
- `GET /api/media/avatar/[userId]` — public; same pattern for `avatars/{userId}`.
- The right panel's Vacancy tab shows the **responsible user** (`vacancy.userId` → `OwnerRow` in `vacancy-panel.tsx`) as an avatar + name (no email) and a **dropdown to reassign** it to any company member (`setVacancyOwner` action, validated against org membership; member list from `getOrgMembers`).

## Testing

- Vitest, node environment, tests in `tests/**/*.test.ts`, `@/` alias via `vite-tsconfig-paths`.
- `server-only`/`client-only` are aliased to `tests/stubs/empty.ts` (see `vitest.config.ts`) so server modules import under test.
- Current coverage: pure helpers (slug/format/validation), storage round-trip + path-traversal safety, email send (Resend mocked: dev swallows failures, prod throws). DB-touching actions/routes are not yet covered — add integration tests against a disposable DB when expanding.

## Gotchas

- **kysely is pinned to `0.28.17`** in `pnpm-workspace.yaml` overrides. better-auth's kysely-adapter imports migrator constants from kysely's main entry, which 0.29.x dropped — without the pin every auth-importing page 500s.
- **Resend sandbox**: with the `onboarding@resend.dev` sender, Resend only delivers to the account owner (`h@ai9.am`); other recipients 403. In dev, `email.ts` logs the link to the server console and does not throw, so login works with any email. For real delivery, verify a domain and set `EMAIL_FROM`.
- **Radix triggers** (Tabs, DropdownMenu) activate on `mousedown`/pointer events, not `click` — relevant when scripting the browser in tests/preview.
- **Radix `ScrollArea` breaks `truncate`**: its inner viewport content is `display:table` (min-content width), so flex children overflow horizontally instead of truncating. The sidebar uses a plain `overflow-y-auto` div instead (native scrollbars are already styled thin in `globals.css`).
- **No native browser dialogs/validation** — everything is in-app UI. (1) `DialogContent` (`ui/dialog.tsx`) is mobile-first: a bottom sheet on `max-sm` (slides up from the bottom, rounded top) and a centered modal on `sm+`, so every `Dialog` adapts automatically. (2) Confirmations use `ui/confirm-dialog.tsx` (`ConfirmDialog`), never `window.confirm`. (3) Forms set `noValidate` and validate in JS, showing inline messages via `ui/field-error.tsx` (`FieldError`) + `aria-invalid` on the input — no native `required`/`type=email` popups. Validation copy lives under `t.validation.*`; email checks reuse `isEmail()` from `lib/validation.ts`.
- **Salary always renders a currency symbol** — `formatSalary()`/`currencySymbol()` (`lib/format.ts`) map codes/words (incl. a few localized ones) to a symbol, and the legacy free-text `salaryRange` fallback runs through `symbolizeCurrencyText()` so old values like `"7000 долларов"` show as `"7000 $"`. The `save_vacancy` tool captures salary structurally (min/max/currency code/period), so new vacancies never store a spelled-out currency.
- After moving route folders, stale `.next/types`/`.next/dev/types` validators can make `tsc` fail referencing old paths — re-run `pnpm build` (or delete the stale `.next` types) to regenerate.
- Don't nest interactive elements: a `<button>` inside a `<button>` breaks hydration and silently kills page interactivity (was the candidate card + star rating bug).
- Video lives in **Cloudflare R2** and is served only via a signed URL through the org-checked media route. The `R2_*` env vars are required for any video feature (record/play/transcribe); without them those routes throw. There is no local-disk fallback.
- **Organizations**: every user gets a personal org on first login (via `databaseHooks.user.create.after`); existing rows were backfilled by SQL. `vacancy.organizationId` is nullable in the schema (for migration) but always set in practice — access checks treat a null-org vacancy as inaccessible.
- **AI eval / transcription** is best-effort and silently skipped without `OPENAI_API_KEY`; transcripts are stored per answer at upload, the candidate-level evaluation runs at completion and can be re-run from the candidate detail (`rerunEvaluation`).
- **Agent runs treat candidate content as hostile**: transcripts/names go into prompts only through `untrustedBlock()` (`<candidate_data>` fencing + control-char strip + length cap), and the system prompt forbids following instructions found there. Keep this for ANY new prompt that embeds candidate-supplied text — a candidate can literally say "ignore previous instructions" on camera.
- **Agent idempotency**: `agent_task.key` (`screen:<candidateId>`) is checked at run start and recorded only after success — re-triggering `/complete` is a no-op, a crashed run retries.
- **Vacancy lifecycle** (`src/lib/vacancy-lifecycle.ts`, pure + unit-tested): `draft → published ⇄ closed → archived`, restore `archived → draft`. `canTransition()` gates the `setVacancyStatus` action (publishing a draft still goes through `publishVacancy`, which validates content + builds the slug). `isAcceptingCandidates()` (= published only) gates the public apply action AND the interview `answer`/`complete` routes (return **410** otherwise) — this is also what stops the agent. `getPublicVacancy` returns published **and** closed (the public page shows a closed notice via `isPubliclyVisible`); draft/archived 404. Lifecycle buttons live in the panel's `ShareCard` (close/reopen/archive/restore).
- **`chat_message.source`** distinguishes `'chat'` (interactive) from `'auto'` (autonomous agent posts); `chat_message.user_id` records which org member wrote a user message. The chat polling endpoint only returns `'auto'` rows — client-generated ids differ from DB ids, so polling interactive messages would duplicate them.
- **Agent worker dev/deploy**: `pnpm dev:agent` runs `wrangler dev` (local DOs + alarms, reads `agent-worker/.dev.vars`). Without it, `dispatch.ts` returns false and `/complete` runs the inline fallback (screening works; kickoff + heartbeat don't). Deploy: `cd agent-worker && pnpm deploy`, then `wrangler secret put AGENT_GATEWAY_SECRET / OPENAI_API_KEY`, set `APP_BASE_URL` var, and point `AGENT_WORKER_URL` in the app env at the workers.dev URL. The worker is **excluded from the root tsconfig** (`pnpm check:agent` covers it). Publishing a vacancy that was screened inline then re-dispatched is safe: DO state + PG `agent_task` both dedupe; worst case is a duplicate chat message.
- **Worker/shared code rule**: anything under `src/lib/agent/` imported by `agent-worker/` must stay pure — relative imports only (no `@/` alias), no `server-only`, no Drizzle/Next imports. The worker bundles those files directly from the app tree.
