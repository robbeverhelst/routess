import { Migration } from "@mikro-orm/migrations";

// Persisted surface composition (ADR 0031): SurfaceBuckets along the
// RoutePath, derived once at save so viewing a Route makes zero Valhalla
// calls. Null means "not derived yet"; the derivation is async and fail-open.
export class Migration20260607020000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "surface_composition" jsonb null;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "route" drop column "surface_composition";`);
	}
}
