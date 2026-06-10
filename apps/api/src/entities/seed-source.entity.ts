import { Collection as OrmCollection } from "@mikro-orm/core";
import { Entity, OneToMany, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type { RouteActivity, SeedSourceStatus } from "@routess/core";
import { BaseEntity } from "./base.entity";
import { ExternalRoute } from "./external-route.entity";

export type { SeedSourceStatus } from "@routess/core";

// An external open-data provider that ExternalRoutes are attributed to
// (CONTEXT.md "SeedSource", ADR 0033). The single home for license,
// attribution, refresh cadence, scope, and the green/yellow/red blocklist.
@Entity()
export class SeedSource extends BaseEntity {
	@PrimaryKey()
	id!: number;

	// Stable adapter key, e.g. "eurovelo". Matches SeedSourceMeta.key in core.
	@Property({ unique: true })
	key!: string;

	@Property()
	displayName!: string;

	// SPDX-ish license id, e.g. "ODbL-1.0".
	@Property()
	license!: string;

	// Exact attribution string rendered on every external route page and
	// embedded in exported GPX. The license obligation lives here.
	@Property()
	attribution!: string;

	@Property()
	sourceUrl!: string;

	@Property({ type: "json" })
	countries: string[] = [];

	@Property({ type: "json" })
	activities: RouteActivity[] = [];

	// green: ingestable; yellow: needs manual license verification; red:
	// blocklisted (French GR, Fietsplatform, Wandelnet) — never ingest.
	@Property({ type: "string", default: "yellow" })
	status: SeedSourceStatus = "yellow";

	@Property({ type: "integer", default: 30 })
	refreshIntervalDays = 30;

	// Stable bulk-download URL for the scheduled refresh; null = manual source.
	// text: Overpass feed URLs embed a whole encoded query.
	@Property({ type: "text", nullable: true })
	feedUrl?: string;

	@Property({ type: "timestamp", nullable: true })
	lastRefreshedAt?: Date;

	@OneToMany(
		() => ExternalRoute,
		(route) => route.source,
	)
	routes = new OrmCollection<ExternalRoute>(this);
}
