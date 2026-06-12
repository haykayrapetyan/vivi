CREATE TABLE "candidate_view" (
	"user_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_view_user_id_candidate_id_pk" PRIMARY KEY("user_id","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "chat_read" (
	"user_id" text NOT NULL,
	"vacancy_id" text NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_read_user_id_vacancy_id_pk" PRIMARY KEY("user_id","vacancy_id")
);
--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "avatar_key" text;--> statement-breakpoint
ALTER TABLE "candidate_view" ADD CONSTRAINT "candidate_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_view" ADD CONSTRAINT "candidate_view_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read" ADD CONSTRAINT "chat_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_read" ADD CONSTRAINT "chat_read_vacancy_id_vacancy_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancy"("id") ON DELETE cascade ON UPDATE no action;