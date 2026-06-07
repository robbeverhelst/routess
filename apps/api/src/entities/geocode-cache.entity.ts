import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

// Durable reverse-geocode cache (ADR 0031): place names for a ~100m grid
// cell never change, so this lives in Postgres rather than a TTL store.
// Keyed by the rounded "lat,lng" string (3 decimals, ~110m).
@Entity({ tableName: "geocode_cache" })
export class GeocodeCache {
	@PrimaryKey()
	key!: string;

	@Property()
	city!: string;

	@Property({ nullable: true })
	region?: string;

	@Property({ nullable: true })
	countryCode?: string;

	@Property()
	createdAt: Date = new Date();
}
