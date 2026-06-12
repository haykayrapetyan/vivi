# Recruiting methodology

Vivi's AI recruiter is not a generic chatbot bolted onto a form — its behaviour
is grounded in an established recruiting craft. This document describes the
approach, where it comes from, and exactly how the agent applies it. The same
principles are encoded in the agent's system prompt
(`METHODOLOGY_SECTION` in [`src/lib/agent/prompt.ts`](../src/lib/agent/prompt.ts))
so they apply in every interaction — building a vacancy, writing interview
questions, and screening candidates — both in the interactive chat and in
autonomous runs.

## Where it comes from

The method is distilled from a classic agency / executive-search methodology —
the **36-step process** taught by Nicholas Bern (CBR Group). Its central
metaphor is a pilot's pre-flight checklist: a systematic, repeatable process is
what guarantees consistent quality, rather than relying on memory or instinct.
We don't reproduce all 36 operational steps (many are agency-specific:
client visits, fee negotiation, resignation coaching). We extract the parts that
make an AI recruiter genuinely good at the judgement-heavy work: defining the
role, probing for evidence, and assessing fit.

## The principles, and how the agent applies them

### 1. Satisfaction = expectations meeting reality

> "Job satisfaction is the result of the match between expectations and reality."

A hire lasts when what the candidate was told matches what the job actually is.
So the foundation of everything is a **precise, honest role definition**.

**Agent behaviour:** when building or refining a vacancy the agent pushes for
specifics and never oversells. A vague brief sends the whole search off-target.

### 2. Describe results, not duties

The strongest position descriptions capture the **results** the hire must
deliver and the **real problems** they must solve — what "great" looks like in
6–12 months and how the person will be measured — not merely a list of
responsibilities.

**Agent behaviour:** the vacancy chat asks what success looks like and what
problem the role exists to solve; the generated description is framed around
outcomes. Compensation is captured as a full package with a real min/mid/max
range, alongside growth path, team and culture — because "chemistry" (culture
fit) matters as much as raw skill.

### 3. Situational-behavioural (STAR) interviewing

> "Behaviour on a previous job reliably predicts behaviour on the next job in
> similar circumstances."

The most predictive interview questions ask for **concrete past situations** —
what the candidate actually did and what resulted — not hypotheticals or
self-assessment. Questions must be open-ended and never leading.

**Agent behaviour:** the interview questions Vivi generates are STAR-style and
open-ended ("Tell me about a time you…", "Walk me through how you…"), designed
to make candidates reveal real evidence on video rather than rehearsed opinions.

### 4. Evidence-based evaluation

Candidates are judged on **concrete achievements and quantified results**, with
the specific moment that proves the point — not on titles or how well they
describe themselves.

**Agent behaviour:** every screening the agent posts grounds its read in what
the candidate actually said and quotes the convincing moment. It weighs the
factors that predict a lasting hire — can they demonstrably do the work,
intrinsic motivation (not money-first), realism about themselves, ease to work
with, culture fit — and always names both strengths **and** the areas that need
development or verification. A balanced read beats a blunt verdict.

### 5. Urgency

> "Delay is fatal."

Strong candidates disappear. The process values speed.

**Agent behaviour:** the autonomous agent screens every completed interview on
its own, surfaces strong people fast, flags candidates who stall mid-funnel, and
always proposes a concrete next step.

## Where it lives in the code

- **System prompt** — `METHODOLOGY_SECTION` in `src/lib/agent/prompt.ts`,
  appended to the shared agent prompt used by the chat route and the worker.
- **Interview question generation & screening** — flow from that prompt; the
  screening/cycle user-prompts in the same file lean on it.
- **This document** — the human-readable reference; keep it and the prompt in
  sync when the methodology evolves.
