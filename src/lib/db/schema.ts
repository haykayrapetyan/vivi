import { nanoid } from "nanoid";
import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
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

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
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

export const company = pgTable("company", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  website: text("website"),
  descriptionMd: text("description_md"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type VacancyStatus = "draft" | "published" | "closed";

export type VacancyDetails = {
  company?: string;
  location?: string;
  employmentType?: string;
  seniority?: string;
  salaryRange?: string;
  skills?: string[];
  responsibilities?: string[];
  requirements?: string[];
};

export const vacancy = pgTable("vacancy", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  companyId: text("company_id").references(() => company.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull().default("Новая вакансия"),
  status: text("status").$type<VacancyStatus>().notNull().default("draft"),
  descriptionMd: text("description_md"),
  details: jsonb("details").$type<VacancyDetails>(),
  publicSlug: text("public_slug").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ChatRole = "user" | "assistant" | "system";

export const chatMessage = pgTable("chat_message", {
  id: id(),
  vacancyId: text("vacancy_id")
    .notNull()
    .references(() => vacancy.id, { onDelete: "cascade" }),
  role: text("role").$type<ChatRole>().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const interviewQuestion = pgTable("interview_question", {
  id: id(),
  vacancyId: text("vacancy_id")
    .notNull()
    .references(() => vacancy.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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

export const candidate = pgTable("candidate", {
  id: id(),
  vacancyId: text("vacancy_id")
    .notNull()
    .references(() => vacancy.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").$type<CandidateStatus>().notNull().default("applied"),
  rating: integer("rating"),
  notes: text("notes"),
  aiScore: integer("ai_score"),
  aiEvaluation: jsonb("ai_evaluation").$type<AiEvaluation>(),
  aiEvaluatedAt: timestamp("ai_evaluated_at"),
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
});

export const interviewAnswer = pgTable("interview_answer", {
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
});

/* ------------------------------ relations ------------------------------ */

export const userRelations = relations(user, ({ many }) => ({
  vacancies: many(vacancy),
}));

export const companyRelations = relations(company, ({ many }) => ({
  vacancies: many(vacancy),
}));

export const vacancyRelations = relations(vacancy, ({ one, many }) => ({
  owner: one(user, { fields: [vacancy.userId], references: [user.id] }),
  company: one(company, {
    fields: [vacancy.companyId],
    references: [company.id],
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
export type Company = typeof company.$inferSelect;
export type Vacancy = typeof vacancy.$inferSelect;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type InterviewQuestion = typeof interviewQuestion.$inferSelect;
export type Candidate = typeof candidate.$inferSelect;
export type InterviewAnswer = typeof interviewAnswer.$inferSelect;
