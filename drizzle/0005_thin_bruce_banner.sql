ALTER TABLE "vacancy" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "candidate_vacancy_idx" ON "candidate" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "chat_message_vacancy_idx" ON "chat_message" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "interview_answer_candidate_idx" ON "interview_answer" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interview_question_vacancy_idx" ON "interview_question" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "vacancy_org_idx" ON "vacancy" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vacancy_company_idx" ON "vacancy" USING btree ("company_id");