import { Migration } from "@mikro-orm/migrations";

// Open-data feeds outgrow varchar(255): Overpass feed URLs embed an encoded
// query, and OSM route descriptions run long.
export class Migration20260610010000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "seed_source" alter column "feed_url" type text;`);
		this.addSql(`alter table "external_route" alter column "description" type text;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "seed_source" alter column "feed_url" type varchar(255);`);
		this.addSql(`alter table "external_route" alter column "description" type varchar(255);`);
	}
}
