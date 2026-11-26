import { Migration } from "@mikro-orm/migrations";

// External-fork lineage and license on Route (ADR 0035): a Route forked from
// an ExternalRoute records which one, plus the SeedSource license and
// attribution it inherited. A plain integer, no foreign key, so the user
// routes table stays independent of the external layer. Null for every
// existing Route.
export class Migration20261126000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "forked_from_external_route_id" int null;`);
		this.addSql(`alter table "route" add column "source_license" varchar(255) null;`);
		this.addSql(`alter table "route" add column "source_attribution" varchar(255) null;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "route" drop column "source_attribution";`);
		this.addSql(`alter table "route" drop column "source_license";`);
		this.addSql(`alter table "route" drop column "forked_from_external_route_id";`);
	}
}
