CREATE TYPE "public"."category" AS ENUM('javascript', 'react', 'typescript');--> statement-breakpoint
CREATE TYPE "public"."seniority_level" AS ENUM('junior', 'mid', 'senior');--> statement-breakpoint
CREATE TABLE "question_variants" (
	"question_id" text NOT NULL,
	"seniority_level" "seniority_level",
	"text_override" text,
	"key_points" text[] NOT NULL,
	CONSTRAINT "question_variants_question_id_seniority_level_unique" UNIQUE NULLS NOT DISTINCT("question_id","seniority_level")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"category" "category" NOT NULL,
	"text" text NOT NULL,
	"explanation" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_variants" ADD CONSTRAINT "question_variants_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;