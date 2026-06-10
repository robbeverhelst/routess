import type { Coordinate, RouteActivity } from "../types";

// Seeding (CONTEXT.md "Seeding", ADR 0033). These types describe the open-data
// ExternalRoute layer: the normalized shape adapters emit, and the SeedSource
// metadata that carries license/attribution/refresh/takedown.

// Green/yellow/red verification status of a SeedSource. Only `green` sources
// may be ingested; `yellow` needs manual license verification first; `red` is
// the blocklist (French GR, Fietsplatform, Wandelnet) and is excluded by
// construction — an adapter for a red source must never run.
export const SEED_SOURCE_STATUSES = ["green", "yellow", "red"] as const;
export type SeedSourceStatus = (typeof SEED_SOURCE_STATUSES)[number];

// Static metadata for one external data provider. Mirrored by the SeedSource
// entity in the API; the adapter registry keys on `key`.
export interface SeedSourceMeta {
	// Stable identifier, e.g. "eurovelo". Half of an ExternalRoute's identity.
	key: string;
	displayName: string;
	// SPDX-ish license id, e.g. "ODbL-1.0", "CC-BY-4.0".
	license: string;
	// The exact attribution string the license requires, rendered on every
	// external route page and embedded in exported GPX metadata.
	attribution: string;
	// Dataset / homepage URL the attribution links to.
	sourceUrl: string;
	// ISO 3166-1 alpha-2 codes this source covers, e.g. ["BE", "NL"].
	countries: string[];
	activities: RouteActivity[];
	status: SeedSourceStatus;
	// How often the refresh job should re-pull this source.
	refreshIntervalDays: number;
	// Stable bulk-download URL the refresh job fetches. Absent = the source has
	// no stable feed (e.g. EuroVelo's per-route pages) and stays manual: the
	// seed script is run by hand with downloaded files.
	feedUrl?: string;
}

// One external route as emitted by an adapter, before persistence. Geometry is
// [lng, lat] pairs (the RoutePath order used everywhere else). `sourceRecordId`
// is the stable id within the source: together with the SeedSource key it forms
// the upsert key, so a refresh updates rather than duplicates (ADR 0033).
export interface SeedRoute {
	sourceRecordId: string;
	name: string;
	description?: string;
	activity?: RouteActivity;
	geometry: Coordinate[];
	tags?: string[];
	// Meters. Computed from geometry by the pipeline when an adapter omits it.
	distance?: number;
	// ISO timestamp of the source's last change to this record, when known.
	sourceUpdatedAt?: string;
}

// A source adapter: its static metadata plus a PURE parse of an
// already-fetched payload into normalized SeedRoutes. Fetching (network,
// impure) lives in the orchestration layer, so `parse` is fixture-testable.
export interface SeedAdapter {
	meta: SeedSourceMeta;
	parse(payload: string): SeedRoute[];
}
