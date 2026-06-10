import { type Ref } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from "@mikro-orm/decorators/legacy";
import type { RouteActivity } from "@routess/core";
import { BaseEntity } from "./base.entity";
import { SeedSource } from "./seed-source.entity";

// A route derived from a licensed external SeedSource (CONTEXT.md
// "ExternalRoute", ADR 0033). Its own table, NO foreign key to Route or User,
// so ODbL share-alike never reaches user routes. Always public, immutable,
// ownerless; combined with Route only at read time. The (source, sourceRecordId)
// pair is the idempotent upsert key; refresh updates rather than duplicates.
@Entity()
@Unique({ properties: ["source", "sourceRecordId"] })
@Index({ properties: ["placeCity"] })
@Index({ properties: ["activity"] })
export class ExternalRoute extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@Property()
	name!: string;

	@Property({ type: "text", nullable: true })
	description?: string;

	@Property({ type: "string", nullable: true })
	activity?: RouteActivity;

	@Property({ type: "json" })
	tags: string[] = [];

	// The RoutePath as [lng, lat] pairs. ExternalRoutes have no Waypoints (they
	// did not come from waypoint placement); geometry is the whole record.
	@Property({ type: "json" })
	geometry!: [number, number][];

	@Property({ type: "float", nullable: true })
	distance?: number;

	@Property({ type: "integer", nullable: true })
	duration?: number;

	@Property({ type: "float", nullable: true })
	elevationGain?: number;

	// Persisted bbox for viewport queries, same as Route (ADR 0030).
	@Property({ type: "float", nullable: true })
	bboxMinLat?: number;

	@Property({ type: "float", nullable: true })
	bboxMaxLat?: number;

	@Property({ type: "float", nullable: true })
	bboxMinLng?: number;

	@Property({ type: "float", nullable: true })
	bboxMaxLng?: number;

	@Property({ nullable: true })
	placeCity?: string;

	@Property({ nullable: true })
	placeRegion?: string;

	@Property({ nullable: true })
	placeCountryCode?: string;

	@ManyToOne(() => SeedSource, { deleteRule: "cascade" })
	source!: Ref<SeedSource>;

	// Stable id within the source. Half of the upsert key (the other half is
	// the source FK).
	@Property()
	sourceRecordId!: string;

	// When the source last changed this record, when known. Drives the neutral
	// Discover sort (ExternalRoutes have no PublishedAt).
	@Property({ type: "timestamp", nullable: true })
	sourceUpdatedAt?: Date;

	// Hash of the normalized payload, so a refresh skips unchanged records.
	@Property()
	contentHash!: string;
}
