import { nanoid } from "nanoid";
import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

/* ----------------------------- better-auth ----------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  theme: text("theme").$type<"light" | "dark">(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* --------------------- better-auth: organizations ---------------------- */

// An organization IS a company (one company per workspace). The company
// profile (website / AI description / logo) lives here.
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  website: text("website"),
  descriptionMd: text("description_md"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------- domain -------------------------------- */

// A "group" is an optional, name-only grouping of vacancies inside a company.
// (Kept on the DB table "company" to avoid a destructive rename.)
export const group = pgTable("company", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type VacancyStatus = "draft" | "published" | "closed" | "archived";

export type WorkMode = "remote" | "hybrid" | "onsite";
export type SalaryPeriod = "month" | "year" | "hour";

export type VacancyDetails = {
  employmentType?: string;
  workMode?: WorkMode;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  seniority?: string;
  skills?: string[];
  // legacy fields (kept for older rows)
  company?: string;
  salaryRange?: string;
};

export const vacancy = pgTable("vacancy", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  groupId: text("company_id").references(() => group.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("New vacancy"),
  status: text("status").$type<VacancyStatus>().notNull().default("draft"),
  descriptionMd: text("description_md"),
  details: jsonb("details").$type<VacancyDetails>(),
  publicSlug: text("public_slug").unique(),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => [
  index("vacancy_org_idx").on(t.organizationId),
  index("vacancy_company_idx").on(t.groupId),
]);

export type ChatRole = "user" | "assistant" | "system";

// 'chat' = written in the interactive conversation; 'auto' = posted by an
// autonomous agent run (screening result, digest, …).
export type ChatSource = "chat" | "auto";

export const chatMessage = pgTable(
  "chat_message",
  {
    id: id(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancy.id, { onDelete: "cascade" }),
    role: text("role").$type<ChatRole>().notNull(),
    content: text("content").notNull(),
    source: text("source").$type<ChatSource>().notNull().default("chat"),
    // Which org member wrote a user message (chat is shared per vacancy).
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_message_vacancy_idx").on(t.vacancyId)],
);

/* -------------------------------- agent -------------------------------- */

// Autonomy ladder: suggest = analyse + recommend in chat only;
// draft = prepare outward actions for approval; act = execute with limits.
export type AgentAutonomy = "suggest" | "draft" | "act";

// One recruiter agent per vacancy. Created lazily on first use.
export const vacancyAgent = pgTable("vacancy_agent", {
  id: id(),
  vacancyId: text("vacancy_id")
    .notNull()
    .unique()
    .references(() => vacancy.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  autonomy: text("autonomy").$type<AgentAutonomy>().notNull().default("suggest"),
  // Standing instructions from the recruiter ("focus on senior remote", …).
  instructions: text("instructions"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AgentTrigger =
  | "candidate_completed"
  | "published"
  | "schedule"
  | "manual";
export type AgentRunStatus = "running" | "done" | "failed" | "skipped";

// Audit log: one row per agent wake-up.
export const agentRun = pgTable(
  "agent_run",
  {
    id: id(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancy.id, { onDelete: "cascade" }),
    trigger: text("trigger").$type<AgentTrigger>().notNull(),
    status: text("status").$type<AgentRunStatus>().notNull().default("running"),
    summary: text("summary"),
    error: text("error"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("agent_run_vacancy_idx").on(t.vacancyId)],
);

// Idempotency: a unit of agent work that must happen at most once
// (e.g. key "screen:<candidateId>"). Insert-first; unique key races safely.
export const agentTask = pgTable(
  "agent_task",
  {
    id: id(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancy.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),
    runId: text("run_id").references(() => agentRun.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("agent_task_vacancy_idx").on(t.vacancyId)],
);

export const interviewQuestion = pgTable(
  "interview_question",
  {
    id: id(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancy.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("interview_question_vacancy_idx").on(t.vacancyId)],
);

export type CandidateStatus =
  | "applied"
  | "interviewing"
  | "completed"
  | "shortlisted"
  | "rejected";

export type AiEvaluation = {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
};

export const candidate = pgTable(
  "candidate",
  {
    id: id(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancy.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    status: text("status")
      .$type<CandidateStatus>()
      .notNull()
      .default("applied"),
    rating: integer("rating"),
    notes: text("notes"),
    aiScore: integer("ai_score"),
    aiEvaluation: jsonb("ai_evaluation").$type<AiEvaluation>(),
    aiEvaluatedAt: timestamp("ai_evaluated_at"),
    // R2 key of a frame captured from the interview video (the avatar)
    avatarKey: text("avatar_key"),
    // Candidate-provided resume: a link they pasted and/or an uploaded file
    // (R2 key), collected right after they start the interview.
    resumeUrl: text("resume_url"),
    resumeKey: text("resume_key"),
    // token used by the candidate to access their interview page
    publicToken: text("public_token")
      .notNull()
      .unique()
      .$defaultFn(() => nanoid(32)),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("candidate_vacancy_idx").on(t.vacancyId)],
);

/* --------------------------- read tracking ----------------------------- */

// Per-user read cursor for a vacancy's chat (unread = agent messages newer
// than lastReadAt). The chat is org-shared, so the cursor is per member.
export const chatRead = pgTable(
  "chat_read",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancy.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.vacancyId] })],
);

// Which candidates a member has opened (drives the "New" label + tab badge).
export const candidateView = pgTable(
  "candidate_view",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidate.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.candidateId] })],
);

export const interviewAnswer = pgTable(
  "interview_answer",
  {
    id: id(),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidate.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => interviewQuestion.id, { onDelete: "cascade" }),
    videoPath: text("video_path").notNull(),
    mimeType: text("mime_type").notNull().default("video/webm"),
    durationSec: integer("duration_sec"),
    transcript: text("transcript"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("interview_answer_candidate_idx").on(t.candidateId)],
);

/* ------------------------------ relations ------------------------------ */

export const userRelations = relations(user, ({ many }) => ({
  vacancies: many(vacancy),
}));

export const groupRelations = relations(group, ({ many }) => ({
  vacancies: many(vacancy),
}));

export const vacancyRelations = relations(vacancy, ({ one, many }) => ({
  owner: one(user, { fields: [vacancy.userId], references: [user.id] }),
  group: one(group, {
    fields: [vacancy.groupId],
    references: [group.id],
  }),
  messages: many(chatMessage),
  questions: many(interviewQuestion),
  candidates: many(candidate),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  vacancy: one(vacancy, {
    fields: [chatMessage.vacancyId],
    references: [vacancy.id],
  }),
}));

export const interviewQuestionRelations = relations(
  interviewQuestion,
  ({ one, many }) => ({
    vacancy: one(vacancy, {
      fields: [interviewQuestion.vacancyId],
      references: [vacancy.id],
    }),
    answers: many(interviewAnswer),
  }),
);

export const candidateRelations = relations(candidate, ({ one, many }) => ({
  vacancy: one(vacancy, {
    fields: [candidate.vacancyId],
    references: [vacancy.id],
  }),
  answers: many(interviewAnswer),
}));

export const interviewAnswerRelations = relations(interviewAnswer, ({ one }) => ({
  candidate: one(candidate, {
    fields: [interviewAnswer.candidateId],
    references: [candidate.id],
  }),
  question: one(interviewQuestion, {
    fields: [interviewAnswer.questionId],
    references: [interviewQuestion.id],
  }),
}));

/* ------------------------------- types --------------------------------- */

export type User = typeof user.$inferSelect;
export type Group = typeof group.$inferSelect;
export type Organization = typeof organization.$inferSelect;
export type Vacancy = typeof vacancy.$inferSelect;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type InterviewQuestion = typeof interviewQuestion.$inferSelect;
export type Candidate = typeof candidate.$inferSelect;
export type InterviewAnswer = typeof interviewAnswer.$inferSelect;
export type VacancyAgent = typeof vacancyAgent.$inferSelect;
export type AgentRun = typeof agentRun.$inferSelect;
export type AgentTask = typeof agentTask.$inferSelect;
