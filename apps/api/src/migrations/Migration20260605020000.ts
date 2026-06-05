import { Migration } from "@mikro-orm/migrations";

// Emails are now normalized to lowercase on every creation path (the email
// flow always did; Google sign-in previously stored the address as-is).
// Lowercase existing rows defensively: skip any row whose lowercased email
// would collide with another user (manual dedup needed there; blind update
// would violate the unique constraint).
export class Migration20260605020000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			update "user" u set "email" = lower("email")
			where "email" <> lower("email")
			and not exists (
				select 1 from "user" u2 where u2."email" = lower(u."email") and u2."id" <> u."id"
			);
		`);
	}

	override async down(): Promise<void> {
		// Lowercasing is not reversible; nothing to do.
	}
}
