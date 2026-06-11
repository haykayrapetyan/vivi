CREATE TABLE "agent_run" (
	"id" text PRIMARY KEY NOT NULL,
	"vacancy_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" text,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_task" (
	"id" text PRIMARY KEY NOT NULL,
	"vacancy_id" text NOT NULL,
	"key" text NOT NULL,
	"run_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_task_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "vacancy_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"vacancy_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"autonomy" text DEFAULT 'suggest' NOT NULL,
	"instructions" text,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vacancy_agent_vacancy_id_unique" UNIQUE("vacancy_id")
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "source" text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_vacancy_id_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task" ADD CONSTRAINT "agent_task_vacancy_id_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task" ADD CONSTRAINT "agent_task_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_agent" ADD CONSTRAINT "vacancy_agent_vacancy_id_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_vacancy_idx" ON "agent_run" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "agent_task_vacancy_idx" ON "agent_task" USING btree ("vacancy_id");--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;