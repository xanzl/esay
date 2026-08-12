CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"images" text DEFAULT '[]' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"nickname" text,
	"avatar_url" text,
	"bio" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
