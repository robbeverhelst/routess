import { Migration } from "@mikro-orm/migrations";

// Discovery (ADR 0029) + Place attribution (#233):
// - route bbox as four plain float columns, backfilled here from geometry.
// - place_city/place_region/place_country_code derived by reverse geocoding;
//   backfilled by the idempotent backfill script, not here (external calls
//   don't belong in migrations).
export class Migration20260607000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "bbox_min_lat" real null;`);
		this.addSql(`alter table "route" add column "bbox_max_lat" real null;`);
		this.addSql(`alter table "route" add column "bbox_min_lng" real null;`);
		this.addSql(`alter table "route" add column "bbox_max_lng" real null;`);
		this.addSql(`alter table "route" add column "place_city" varchar(255) null;`);
		this.addSql(`alter table "route" add column "place_region" varchar(255) null;`);
		this.addSql(`alter table "route" add column "place_country_code" varchar(255) null;`);
		this.addSql(`create index "route_visibility_published_at_index" on "route" ("visibility", "published_at");`);
		this.addSql(`create index "route_place_city_index" on "route" ("place_city");`);

		// One-shot bbox backfill from the stored RoutePath ([lng, lat] pairs).
		this.addSql(`
			update "route" set
				"bbox_min_lat" = sub.min_lat,
				"bbox_max_lat" = sub.max_lat,
				"bbox_min_lng" = sub.min_lng,
				"bbox_max_lng" = sub.max_lng
			from (
				select r.id,
					min((elem->>1)::real) as min_lat,
					max((elem->>1)::real) as max_lat,
					min((elem->>0)::real) as min_lng,
					max((elem->>0)::real) as max_lng
				from "route" r
				cross join lateral jsonb_array_elements(r.geometry) elem
				where jsonb_typeof(r.geometry) = 'array' and jsonb_typeof(elem) = 'array'
				group by r.id
			) sub
			where "route".id = sub.id;
		`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop index "route_visibility_published_at_index";`);
		this.addSql(`drop index "route_place_city_index";`);
		this.addSql(`alter table "route" drop column "bbox_min_lat";`);
		this.addSql(`alter table "route" drop column "bbox_max_lat";`);
		this.addSql(`alter table "route" drop column "bbox_min_lng";`);
		this.addSql(`alter table "route" drop column "bbox_max_lng";`);
		this.addSql(`alter table "route" drop column "place_city";`);
		this.addSql(`alter table "route" drop column "place_region";`);
		this.addSql(`alter table "route" drop column "place_country_code";`);
	}
}
