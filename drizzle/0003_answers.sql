CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_question_id" uuid NOT NULL,
	"follow_up_index" integer DEFAULT 0 NOT NULL,
	"transcript" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_interview_question_id_follow_up_index_unique" UNIQUE("interview_question_id","follow_up_index")
);
--> statement-breakpoint
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_interview_question_id_interview_questions_id_fk" FOREIGN KEY ("interview_question_id") REFERENCES "public"."interview_questions"("id") ON DELETE cascade ON UPDATE no action;