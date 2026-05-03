import { Migration } from "@mikro-orm/migrations";

export class Migration20260503150931 extends Migration {
	override async up(): Promise<void> {
		this.addSql('alter table "route" add column "geometry" jsonb null;');
	}

	override async down(): Promise<void> {
		this.addSql('alter table "route" drop column "geometry";');
	}
}
