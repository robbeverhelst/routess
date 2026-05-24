import { Migration } from "@mikro-orm/migrations";

// Adds routing inputs (routing_preferences) and provenance to the route table.
// See ADR-0023. Existing routes were computed by Mapbox and have no recorded
// inputs, so they get provenance='mapbox-legacy' and routing_preferences=null.
// New routes created after this point default to provenance='valhalla'.
export class Migration20260515000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "routing_preferences" jsonb null;`);
		this.addSql(`alter table "route" add column "provenance" varchar(255) not null default 'valhalla';`);
		// Backfill: every row that exists at migration time predates the Valhalla
		// switch and was produced by Mapbox.
		this.addSql(`update "route" set "provenance" = 'mapbox-legacy';`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "route" drop column "provenance";`);
		this.addSql(`alter table "route" drop column "routing_preferences";`);
	}
}
