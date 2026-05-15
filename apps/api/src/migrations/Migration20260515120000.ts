import { Migration } from "@mikro-orm/migrations";

// Adds the personal_access_token table for non-browser clients
// (CLI, AI agents, scripts). See ADR-0022. Tokens are stored as
// HMAC-SHA-256(plaintext, server_pepper); the pepper lives in
// the API config alongside JWT_SECRET. scope is one of 'read'
// or 'write'. revokedAt is a soft-revoke timestamp so we can
// audit revocation events without losing the row, on top of
// BaseEntity's deletedAt which handles hard delete.
export class Migration20260515120000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			create table "personal_access_token" (
				"id" serial primary key,
				"token_hash" varchar(255) not null,
				"user_id" int not null,
				"label" varchar(255) not null,
				"scope" varchar(255) not null,
				"expires_at" timestamptz null,
				"last_used_at" timestamptz null,
				"revoked_at" timestamptz null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "personal_access_token_user_id_fk"
					foreign key ("user_id") references "user"("id") on update cascade
			);
		`);
		this.addSql(`
			create unique index "personal_access_token_token_hash_unique"
				on "personal_access_token" ("token_hash");
		`);
		this.addSql(`
			create index "personal_access_token_user_id_idx"
				on "personal_access_token" ("user_id");
		`);
		this.addSql(`
			create index "personal_access_token_revoked_at_idx"
				on "personal_access_token" ("revoked_at");
		`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table if exists "personal_access_token";`);
	}
}
