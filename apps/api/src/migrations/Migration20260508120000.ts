import { Migration } from "@mikro-orm/migrations";

// Adds the `role` column to the user table to support RBAC. The column is a
// cache of the ADMIN_EMAILS env var, reconciled at login time (ADR-0015).
// Existing rows default to 'user'; bootstrap a first admin by setting
// ADMIN_EMAILS in Helm values and triggering a relogin for that account.
export class Migration20260508120000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "user" add column "role" varchar(255) not null default 'user';`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "user" drop column "role";`);
	}
}
