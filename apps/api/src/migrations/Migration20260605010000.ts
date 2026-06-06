import { Migration } from "@mikro-orm/migrations";

// Per-account login lockout: consecutive failed password attempts and the
// lock expiry live on the email auth method. Complements the per-IP throttle,
// which alone is bypassable by distributing attempts across IPs.
export class Migration20260605010000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "user_auth_method" add column "failed_login_attempts" int not null default 0;`);
		this.addSql(`alter table "user_auth_method" add column "locked_until" timestamptz null;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "user_auth_method" drop column "locked_until";`);
		this.addSql(`alter table "user_auth_method" drop column "failed_login_attempts";`);
	}
}
