CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"membership_id" uuid,
	"code" text,
	"method" text NOT NULL,
	"allowed" boolean NOT NULL,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "credentials_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_no" integer GENERATED ALWAYS AS IDENTITY (sequence name "members_member_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"nickname" text,
	"email" text,
	"phone" text,
	"line_id" text,
	"birth_date" date,
	"gender" text,
	"emergency_contact" text,
	"notes" text,
	"photo_url" text,
	"source" text DEFAULT 'admin' NOT NULL,
	"external_id" text,
	"pass_token" text NOT NULL,
	"marketing_opt_in" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "members_pass_token_unique" UNIQUE("pass_token")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"kind" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"sessions_total" integer,
	"sessions_used" integer DEFAULT 0 NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"payment_ref" text,
	"frozen_from" date,
	"frozen_until" date,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"source" text DEFAULT 'admin' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"ends_on" date NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"amount_satang" integer NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text,
	"payment_method" text,
	"member_id" uuid,
	"items" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_member_idx" ON "activity" USING btree ("member_id","at");--> statement-breakpoint
CREATE INDEX "check_ins_at_idx" ON "check_ins" USING btree ("at");--> statement-breakpoint
CREATE INDEX "check_ins_member_idx" ON "check_ins" USING btree ("member_id","at");--> statement-breakpoint
CREATE INDEX "credentials_member_idx" ON "credentials" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_no_idx" ON "members" USING btree ("member_no");--> statement-breakpoint
CREATE INDEX "members_email_idx" ON "members" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "members_phone_idx" ON "members" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "members_external_idx" ON "members" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "memberships_member_idx" ON "memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "memberships_ends_idx" ON "memberships" USING btree ("ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_once_idx" ON "reminders" USING btree ("member_id","ends_on","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_external_idx" ON "sales" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "sales_at_idx" ON "sales" USING btree ("occurred_at");