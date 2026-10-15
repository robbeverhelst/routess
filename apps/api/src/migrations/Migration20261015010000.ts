import { Migration } from "@mikro-orm/migrations";

// Carries the signup form's WeeklyDigest checkbox from the signup request to
// verification, where the User is created. Default false: no consent unless
// the box was ticked.
export class Migration20261015010000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "verification_token" add column "weekly_digest_opt_in" boolean not null default false;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "verification_token" drop column "weekly_digest_opt_in";`);
	}
}
