CREATE TABLE "cafe_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"customer_name" text NOT NULL,
	"contact" text,
	"service_mode" text NOT NULL,
	"table" text,
	"pickup_time" text,
	"note" text,
	"lines" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"protein" integer,
	"kcal" integer,
	"payment_method" text NOT NULL,
	"payment_status" text NOT NULL,
	"member_id" uuid,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"vendor" text,
	"amount_satang" integer NOT NULL,
	"recurring" text DEFAULT 'none' NOT NULL,
	"ends_on" date,
	"payment_method" text,
	"staff_id" uuid,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"line_id" text,
	"source" text DEFAULT 'walk-in' NOT NULL,
	"interest" text DEFAULT 'membership' NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"owner_id" uuid,
	"next_follow_up" date,
	"lost_reason" text,
	"member_id" uuid,
	"demo" boolean DEFAULT false NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"audience" text NOT NULL,
	"audience_label" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"recipients" integer NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"staff_id" uuid,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pt_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"coach_slug" text NOT NULL,
	"package_id" text,
	"date" date NOT NULL,
	"time" text NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"goal" text,
	"note" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"lead_id" uuid,
	"member_id" uuid,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pt_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"membership_id" uuid,
	"coach_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'done' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL,
	"area" text DEFAULT 'desk' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"phone" text,
	"pin_hash" text,
	"coach_slug" text,
	"hourly_rate" integer,
	"pt_commission_pct" integer,
	"color" text,
	"active" boolean DEFAULT true NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"clock_in" timestamp with time zone NOT NULL,
	"clock_out" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "staff_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "cafe_orders" ADD CONSTRAINT "cafe_orders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_staff_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_bookings" ADD CONSTRAINT "pt_bookings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_bookings" ADD CONSTRAINT "pt_bookings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_coach_id_staff_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cafe_orders_created_idx" ON "cafe_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cafe_orders_status_idx" ON "cafe_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage","created_at");--> statement-breakpoint
CREATE INDEX "pt_bookings_date_idx" ON "pt_bookings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "pt_sessions_at_idx" ON "pt_sessions" USING btree ("at");--> statement-breakpoint
CREATE INDEX "pt_sessions_coach_idx" ON "pt_sessions" USING btree ("coach_id","at");--> statement-breakpoint
CREATE INDEX "shifts_date_idx" ON "shifts" USING btree ("date");--> statement-breakpoint
CREATE INDEX "time_entries_staff_idx" ON "time_entries" USING btree ("staff_id","clock_in");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_at_idx" ON "activity" USING btree ("at");--> statement-breakpoint
CREATE INDEX "activity_lead_idx" ON "activity" USING btree ("lead_id");