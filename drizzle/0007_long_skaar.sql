ALTER TABLE "vacancy" DROP CONSTRAINT "vacancy_company_id_company_id_fk";
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "description_md" text;--> statement-breakpoint
ALTER TABLE "vacancy" ADD CONSTRAINT "vacancy_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "website";--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "description_md";