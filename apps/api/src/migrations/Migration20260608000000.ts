import { Migration } from "@mikro-orm/migrations";

// Seeded routes (ADR 0035):
// - seed_source: external open-data providers (license, attribution, refresh,
//   green/yellow/red status).
// - external_route: routes derived from those sources, in their OWN table with
//   NO foreign key to "route" or "user", so ODbL share-alike never reaches user
//   routes. Combined with Route only at read time.
// - the reserved system seed User that owns Generated fill Routes.
export class Migration20260608000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			create table "seed_source" (
				"id" serial primary key,
				"key" varchar(255) not null,
				"display_name" varchar(255) not null,
				"license" varchar(255) not null,
				"attribution" varchar(255) not null,
				"source_url" varchar(255) not null,
				"countries" jsonb not null default '[]',
				"activities" jsonb not null default '[]',
				"status" varchar(255) not null default 'yellow',
				"refresh_interval_days" int not null default 30,
				"last_refreshed_at" timestamptz null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null
			);
		`);
		this.addSql(`alter table "seed_source" add constraint "seed_source_key_unique" unique ("key");`);

		this.addSql(`
			create table "external_route" (
				"id" serial primary key,
				"name" varchar(255) not null,
				"description" varchar(255) null,
				"activity" varchar(255) null,
				"tags" jsonb not null default '[]',
				"geometry" jsonb not null,
				"distance" real null,
				"duration" int null,
				"elevation_gain" real null,
				"bbox_min_lat" real null,
				"bbox_max_lat" real null,
				"bbox_min_lng" real null,
				"bbox_max_lng" real null,
				"place_city" varchar(255) null,
				"place_region" varchar(255) null,
				"place_country_code" varchar(255) null,
				"source_id" int not null,
				"source_record_id" varchar(255) not null,
				"source_updated_at" timestamptz null,
				"content_hash" varchar(255) not null,
				"created_at" timestamptz not null default now(),
				"updated_at" timestamptz not null default now(),
				"deleted_at" timestamptz null,
				constraint "external_route_source_id_fk"
					foreign key ("source_id") references "seed_source"("id") on update cascade on delete cascade
			);
		`);
		this.addSql(`
			alter table "external_route"
				add constraint "external_route_source_id_source_record_id_unique" unique ("source_id", "source_record_id");
		`);
		this.addSql(`create index "external_route_source_id_index" on "external_route" ("source_id");`);
		this.addSql(`create index "external_route_place_city_index" on "external_route" ("place_city");`);
		this.addSql(`create index "external_route_activity_index" on "external_route" ("activity");`);
		// Viewport overlap on the persisted bbox columns (ADR 0030), same as route.
		this.addSql(
			`create index "external_route_bbox_index" on "external_route" ("bbox_min_lat", "bbox_max_lat", "bbox_min_lng", "bbox_max_lng");`,
		);

		// Reserved system seed User (CONTEXT.md "system seed User"). Idempotent so
		// re-running against a populated database is a no-op. Values are static
		// literals (no user input), so inlining is safe.
		this.addSql(
			`insert into "user" ("email", "name", "handle", "is_email_verified", "role", "deletion_status", "created_at", "updated_at")
			 values ('system-seed@routess.internal', 'routess', 'routess-seed', true, 'user', 'active', now(), now())
			 on conflict ("email") do nothing;`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(`delete from "user" where "email" = 'system-seed@routess.internal';`);
		this.addSql(`drop table if exists "external_route";`);
		this.addSql(`drop table if exists "seed_source";`);
	}
}
