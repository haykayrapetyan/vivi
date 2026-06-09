ALTER TABLE "candidate" ADD COLUMN "ai_score" integer;--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "ai_evaluation" jsonb;--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "ai_evaluated_at" timestamp;