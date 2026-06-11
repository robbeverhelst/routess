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
	// Stable bulk-download URL the refresh job fetches. Absent (and no
	// feedUrls) = the source has no stable feed and stays manual: the seed
	// script is run by hand with downloaded files.
	feedUrl?: string;
	// Sources published as multiple per-collection downloads (EuroVelo's
	// per-route GPX endpoints). The refresh fetches ALL of them and upserts
	// the combined result in one pass; a single failed feed aborts the
	// source's refresh so the soft-delete sweep cannot prune routes whose
	// feed merely failed to download.
	feedUrls?: { url: string; label?: string }[];
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

// Context the orchestration layer knows but the payload does not. EuroVelo's
// per-route GPX files, for example, never name the route inside the file;
// the label comes from which URL/file was fetched.
export interface SeedParseContext {
	// Human label of the payload's parent route/collection, e.g.
	// "EuroVelo 5 - Via Romea (Francigena)".
	label?: string;
}

// A source adapter: its static metadata plus a PURE parse of an
// already-fetched payload into normalized SeedRoutes. Fetching (network,
// impure) lives in the orchestration layer, so `parse` is fixture-testable.
export interface SeedAdapter {
	meta: SeedSourceMeta;
	parse(payload: string, context?: SeedParseContext): SeedRoute[];
}
