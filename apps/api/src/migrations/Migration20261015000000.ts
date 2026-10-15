import { Migration } from "@mikro-orm/migrations";

// WeeklyDigest: consent timestamp (null = not opted in, so every existing
// User starts opted out), last send, and the routes already mailed.
export class Migration20261015000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			alter table "user"
				add column "weekly_digest_opt_in_at" timestamptz null,
				add column "weekly_digest_last_sent_at" timestamptz null,
				add column "weekly_digest_sent_slug_ids" jsonb null;
		`);
	}

	override async down(): Promise<void> {
		this.addSql(`
			alter table "user"
				drop column "weekly_digest_opt_in_at",
				drop column "weekly_digest_last_sent_at",
				drop column "weekly_digest_sent_slug_ids";
		`);
	}
}
