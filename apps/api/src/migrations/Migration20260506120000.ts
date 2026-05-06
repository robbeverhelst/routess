import { Migration } from "@mikro-orm/migrations";

export class Migration20260506120000 extends Migration {
	override async up(): Promise<void> {
		this.addSql('alter table "user" add column "preferences" jsonb null;');
	}

	override async down(): Promise<void> {
		this.addSql('alter table "user" drop column "preferences";');
	}
}
