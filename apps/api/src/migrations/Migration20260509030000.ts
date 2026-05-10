import { Migration } from "@mikro-orm/migrations";

// Normalises authentication into a separate user_auth_method table (issue #134).
// Each User now has one or more UserAuthMethod rows describing how they sign in
// (currently 'google'; 'email' added by the signup-with-password work). The
// existing User.googleId column is migrated into a UserAuthMethod row per User
// and then dropped — there is no longer any provider-specific column on User.
//
// Backfill is exact: every User with a googleId becomes one google method row;
// users without a googleId (only possible historically via test seed data) get
// no row and won't be able to sign in until they add an auth method.
export class Migration20260509030000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			create table "user_auth_method" (
				"id" serial primary key,
				"user_id" int not null references "user"("id") on delete cascade,
				"provider" varchar(255) not null,
				"provider_id" varchar(255) not null,
				"password_hash" varchar(255) null,
				"last_used_at" timestamptz null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null
			);
		`);
		this.addSql(
			`create unique index "user_auth_method_provider_provider_id_unique" on "user_auth_method" ("provider", "provider_id");`,
		);
		this.addSql(`create index "user_auth_method_user_id_index" on "user_auth_method" ("user_id");`);

		// Backfill: one google method per existing user with a googleId.
		this.addSql(`
			insert into "user_auth_method" ("user_id", "provider", "provider_id", "last_used_at")
			select "id", 'google', "google_id", now()
			from "user"
			where "google_id" is not null;
		`);

		// Drop the now-redundant googleId column.
		this.addSql(`drop index if exists "user_google_id_index";`);
		this.addSql(`alter table "user" drop column "google_id";`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "user" add column "google_id" varchar(255) null;`);
		this.addSql(`create index "user_google_id_index" on "user" ("google_id");`);
		this.addSql(`
			update "user" u
			set "google_id" = m."provider_id"
			from "user_auth_method" m
			where m."user_id" = u."id" and m."provider" = 'google';
		`);
		this.addSql(`drop index "user_auth_method_user_id_index";`);
		this.addSql(`drop index "user_auth_method_provider_provider_id_unique";`);
		this.addSql(`drop table "user_auth_method";`);
	}
}
