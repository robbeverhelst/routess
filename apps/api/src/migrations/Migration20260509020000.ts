import { Migration } from "@mikro-orm/migrations";

// Adds the deletion_status / deletion_requested_at columns to "user" for
// self-initiated account deletion with a 30-day grace window (ADR 0017).
// Existing rows default to 'active'. Admin-driven soft-deletes (ADR 0016)
// leave deletion_status = 'active' and remain reversible on relogin; only the
// new self-deletion path sets 'pending_hard_delete'.
export class Migration20260509020000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "user" add column "deletion_status" varchar(255) not null default 'active';`);
		this.addSql(`alter table "user" add column "deletion_requested_at" timestamptz null;`);
		this.addSql(
			`create index "user_deletion_status_deletion_requested_at_index" on "user" ("deletion_status", "deletion_requested_at");`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(`drop index "user_deletion_status_deletion_requested_at_index";`);
		this.addSql(`alter table "user" drop column "deletion_requested_at";`);
		this.addSql(`alter table "user" drop column "deletion_status";`);
	}
}
