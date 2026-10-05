CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"last_used_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"resource_label" text,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "custom_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"domain" text NOT NULL,
	"verified" boolean DEFAULT false,
	"verified_at" text,
	"cname_target" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "custom_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"original_filename" text,
	"file_type" text NOT NULL,
	"original_mime_type" text,
	"file_size" integer,
	"page_count" integer,
	"video_duration" integer,
	"video_width" integer,
	"video_height" integer,
	"video_qualities" text,
	"r2_prefix" text NOT NULL,
	"expires_at" text,
	"max_views" integer,
	"require_email" boolean DEFAULT true,
	"allowed_domains" text,
	"password_hash" text,
	"block_download" boolean DEFAULT true,
	"watermark_enabled" boolean DEFAULT true,
	"watermark_template" text DEFAULT '{{email}} · {{date}} · {{session_id}}',
	"notify_url" text,
	"notify_email" text,
	"custom_domain_id" text,
	"access_group_id" text,
	"disabled_at" text,
	"brand_logo" text,
	"brand_color" text,
	"brand_name" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"name" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"type" text NOT NULL,
	"link_id" text,
	"link_name" text,
	"message" text NOT NULL,
	"metadata" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "org_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" text NOT NULL,
	"accepted_at" text,
	"revoked_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rendering_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"source_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error" text,
	"started_at" text,
	"completed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"stripe_reported" boolean DEFAULT false,
	"period_start" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"default_org_id" text,
	"spending_cap" integer,
	"email_verified" boolean DEFAULT false,
	"email_verified_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "viewer_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"student_id" text NOT NULL,
	"national_id_hash" text NOT NULL,
	"display_name" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "viewer_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "viewer_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"viewer_email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"ip_address" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "viewer_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" text PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"viewer_email" text,
	"viewer_ip" text,
	"viewer_user_agent" text,
	"viewer_country" text,
	"viewer_city" text,
	"viewer_device" text,
	"viewer_browser" text,
	"viewer_os" text,
	"duration" integer,
	"pages_viewed" integer,
	"page_details" text,
	"completion_rate" real,
	"video_watch_time" integer,
	"video_max_reached" real,
	"session_token" text,
	"return_visit" boolean DEFAULT false,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"ended_at" text
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" text NOT NULL,
	"status_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_retry_at" text,
	"delivered_at" text,
	"failed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendering_jobs" ADD CONSTRAINT "rendering_jobs_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_credentials" ADD CONSTRAINT "viewer_credentials_group_id_viewer_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."viewer_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_sessions" ADD CONSTRAINT "viewer_sessions_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_org_id" ON "audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_org_created" ON "audit_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor_id" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_resource" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_links_user_id" ON "links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_links_org_id" ON "links" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_links_status" ON "links" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_links_created_at" ON "links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_links_user_status_created" ON "links" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_org_invites_token_hash" ON "org_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_org_invites_org_id" ON "org_invites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_invites_email" ON "org_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_members_org_user" ON "org_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_org_members_user_id" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rendering_jobs_status" ON "rendering_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_usage_records_user_period" ON "usage_records" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "idx_viewer_credentials_group" ON "viewer_credentials" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_viewer_credentials_student" ON "viewer_credentials" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_viewer_credentials_group_student" ON "viewer_credentials" USING btree ("group_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_viewer_groups_org" ON "viewer_groups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_viewer_sessions_token" ON "viewer_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_viewer_sessions_link" ON "viewer_sessions" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "idx_views_link_id" ON "views" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "idx_views_created_at" ON "views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_views_viewer_email" ON "views" USING btree ("viewer_email");--> statement-breakpoint
CREATE INDEX "idx_views_session" ON "views" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_next_retry" ON "webhook_deliveries" USING btree ("next_retry_at");