import { Migration } from "@mikro-orm/migrations";

// Adds the verification_token table for email+password signup verification
// and password reset flows (issue #134). One row per outstanding token.
// Tokens are random 32-byte hex strings; lookup is by exact match. Expired
// rows can be left for audit; the consuming endpoints check expiresAt and
// usedAt so old tokens are inert.
export class Migration20260509040000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			create table "verification_token" (
				"id" serial primary key,
				"token" varchar(255) not null,
				"purpose" varchar(255) not null,
				"email" varchar(255) not null,
				"user_id" int null references "user"("id") on delete cascade,
				"password_hash" varchar(255) null,
				"expires_at" timestamptz not null,
				"used_at" timestamptz null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null
			);
		`);
		this.addSql(`create unique index "verification_token_token_unique" on "verification_token" ("token");`);
		this.addSql(`create index "verification_token_email_index" on "verification_token" ("email");`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop index "verification_token_email_index";`);
		this.addSql(`drop index "verification_token_token_unique";`);
		this.addSql(`drop table "verification_token";`);
	}
}
