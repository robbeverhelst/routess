import { Migration } from "@mikro-orm/migrations";

// Durable reverse-geocode cache (ADR 0031): Place lookups for the same ~100m
// grid cell stop hitting Mapbox entirely.
export class Migration20260607030000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`create table "geocode_cache" (
			"key" varchar(255) not null,
			"city" varchar(255) not null,
			"region" varchar(255) null,
			"country_code" varchar(255) null,
			"created_at" timestamptz not null,
			constraint "geocode_cache_pkey" primary key ("key")
		);`);
	}

	override async down(): Promise<void> {
		this.addSql(`drop table "geocode_cache";`);
	}
}
