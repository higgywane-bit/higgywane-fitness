CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pt_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"coach_id" uuid,
	"status" text DEFAULT 'invited' NOT NULL,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"invite_sent_at" timestamp with time zone,
	"invite_channel" text,
	"joined_at" timestamp with time zone,
	"visibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pt_library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pt_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"audience" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pt_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"coach_id" uuid,
	"kind" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"doc" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"day_id" text NOT NULL,
	"day_name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"entries" jsonb NOT NULL,
	"note" text,
	"volume_kg" integer DEFAULT 0 NOT NULL,
	"sets_done" integer DEFAULT 0 NOT NULL,
	"plan_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_feedback" ADD CONSTRAINT "daily_feedback_client_id_pt_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."pt_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_clients" ADD CONSTRAINT "pt_clients_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_clients" ADD CONSTRAINT "pt_clients_coach_id_staff_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_library_items" ADD CONSTRAINT "pt_library_items_coach_id_staff_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_notifications" ADD CONSTRAINT "pt_notifications_client_id_pt_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."pt_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_plans" ADD CONSTRAINT "pt_plans_client_id_pt_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."pt_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_plans" ADD CONSTRAINT "pt_plans_coach_id_staff_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_client_id_pt_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."pt_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_idx" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_subject_idx" ON "auth_sessions" USING btree ("kind","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_accounts_member_idx" ON "client_accounts" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_accounts_email_idx" ON "client_accounts" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "daily_feedback_day_idx" ON "daily_feedback" USING btree ("client_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "pt_clients_member_idx" ON "pt_clients" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "pt_clients_coach_idx" ON "pt_clients" USING btree ("coach_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pt_clients_invite_idx" ON "pt_clients" USING btree ("invite_token_hash");--> statement-breakpoint
CREATE INDEX "pt_library_coach_idx" ON "pt_library_items" USING btree ("coach_id","kind");--> statement-breakpoint
CREATE INDEX "pt_notifications_inbox_idx" ON "pt_notifications" USING btree ("client_id","audience","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pt_plans_client_kind_idx" ON "pt_plans" USING btree ("client_id","kind") WHERE "pt_plans"."client_id" is not null;--> statement-breakpoint
CREATE INDEX "pt_plans_coach_idx" ON "pt_plans" USING btree ("coach_id","kind");--> statement-breakpoint
CREATE INDEX "workout_logs_client_idx" ON "workout_logs" USING btree ("client_id","finished_at");