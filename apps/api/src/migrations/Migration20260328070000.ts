import { Migration } from "@mikro-orm/migrations";

export class Migration20260328070000 extends Migration {
	override async up(): Promise<void> {
		this.addSql('alter table "route" add column "duration" int null;');
		this.addSql('alter table "route" add column "elevation_gain" real null;');
		this.addSql('alter table "route" add column "start_address" varchar(255) null;');
		this.addSql('alter table "route" add column "end_address" varchar(255) null;');
	}

	override async down(): Promise<void> {
		this.addSql('alter table "route" drop column "duration";');
		this.addSql('alter table "route" drop column "elevation_gain";');
		this.addSql('alter table "route" drop column "start_address";');
		this.addSql('alter table "route" drop column "end_address";');
	}
}
