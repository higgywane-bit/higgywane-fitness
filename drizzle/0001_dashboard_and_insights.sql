CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'glofox' NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"file_name" text,
	"headers" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"date_from" date,
	"date_to" date,
	"notes" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "report_uploads_kind_idx" ON "report_uploads" USING btree ("kind","uploaded_at");