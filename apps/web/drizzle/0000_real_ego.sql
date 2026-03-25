CREATE TABLE "paper_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"title" text NOT NULL,
	"blueprint" jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_preset" text DEFAULT 'default' NOT NULL,
	"output_modes" jsonb DEFAULT '["student","teacher"]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_id" text NOT NULL,
	"source_document_id" uuid,
	"source_locator" jsonb,
	"subject" text NOT NULL,
	"grade" text NOT NULL,
	"textbook_version" text,
	"knowledge_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ability_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question_type" text NOT NULL,
	"difficulty" real,
	"content" jsonb NOT NULL,
	"exam_name" text,
	"region" text,
	"school" text,
	"year" integer,
	"source_label" text NOT NULL,
	"review_status" text DEFAULT 'draft' NOT NULL,
	"answer_verified" boolean DEFAULT false NOT NULL,
	"duplicate_cluster_id" text,
	"ocr_confidence" real,
	"reviewer_id" text,
	"rights_status" text NOT NULL,
	"search_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade" text NOT NULL,
	"region" text,
	"year" integer,
	"exam_name" text,
	"paper_type" text,
	"file_ref" text NOT NULL,
	"page_count" integer NOT NULL,
	"rights_status" text NOT NULL,
	"owner_org_id" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_items" ADD CONSTRAINT "question_items_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_qi_subject_grade" ON "question_items" USING btree ("subject","grade");--> statement-breakpoint
CREATE INDEX "idx_qi_question_type" ON "question_items" USING btree ("question_type");--> statement-breakpoint
CREATE INDEX "idx_qi_review_status" ON "question_items" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "idx_qi_difficulty" ON "question_items" USING btree ("difficulty");