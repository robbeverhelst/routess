import { Migration } from "@mikro-orm/migrations";

// NotificationsSeenAt watermark (CONTEXT.md): the Notification list itself is
// derived from follows and route shares; only the seen watermark is stored.
export class Migration20260607010000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "user" add column "notifications_seen_at" timestamptz null;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "user" drop column "notifications_seen_at";`);
	}
}
