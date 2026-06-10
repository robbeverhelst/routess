import { createHash } from "node:crypto";
import { EntityManager, EntityRepository, type FilterQuery } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
	isRouteIndexable,
	routeBoundingBox,
	SEED_ADAPTERS,
	type SeedAdapter,
	type SeedRoute,
	seedAdapterByKey,
} from "@routess/core";
import { ExternalRoute } from "../entities/external-route.entity";
import { SeedSource } from "../entities/seed-source.entity";
import type { PublicRouteSummaryDto } from "../routes/dto/public-route-summary.dto";
import {
	type PublicListingFilters,
	type PublicRouteGate,
	publicListingWhere,
} from "../routes/dto/public-routes-query.dto";
import type { ExternalRouteResponseDto } from "./dto/external-route-response.dto";
import { toExternalRouteResponseDto, toExternalRouteSummaryDto } from "./external-route.mapper";

export interface UpsertResult {
	inserted: number;
	updated: number;
	unchanged: number;
	removed: number;
}

export interface SeedSourceStats {
	key: string;
	displayName: string;
	license: string;
	status: string;
	routeCount: number;
	removedCount: number;
	refreshIntervalDays: number;
	// null = never synced
	lastRefreshedAt: string | null;
	// null = manual source (no feedUrl), never auto-refreshed
	nextRefreshAt: string | null;
	automatic: boolean;
}

export interface RefreshRunResult {
	source: string;
	skipped?: "not-due" | "manual" | "blocked";
	result?: UpsertResult;
	error?: string;
}

function contentHash(seed: SeedRoute): string {
	const h = createHash("sha256");
	h.update(
		JSON.stringify({
			name: seed.name,
			description: seed.description ?? "",
			activity: seed.activity ?? "",
			tags: seed.tags ?? [],
			distance: seed.distance ?? null,
			geometry: seed.geometry,
		}),
	);
	return h.digest("hex");
}

@Injectable()
export class ExternalRoutesService {
	constructor(
		@InjectRepository(ExternalRoute)
		private readonly externalRouteRepository: EntityRepository<ExternalRoute>,
		@InjectRepository(SeedSource)
		private readonly seedSourceRepository: EntityRepository<SeedSource>,
		private readonly em: EntityManager,
	) {}

	// Upserts the SeedSource row from adapter metadata so the orchestration
	// script never hand-writes it. Refuses red (blocklisted) sources by
	// construction (ADR 0033).
	async ensureSource(meta: SeedAdapter["meta"]): Promise<SeedSource> {
		if (meta.status === "red") {
			throw new Error(`Refusing to register blocklisted SeedSource '${meta.key}'`);
		}
		let source = await this.seedSourceRepository.findOne({ key: meta.key });
		if (!source) {
			source = this.seedSourceRepository.create({
				key: meta.key,
				displayName: meta.displayName,
				license: meta.license,
				attribution: meta.attribution,
				sourceUrl: meta.sourceUrl,
				countries: meta.countries,
				activities: meta.activities,
				status: meta.status,
				refreshIntervalDays: meta.refreshIntervalDays,
			});
		} else {
			source.displayName = meta.displayName;
			source.license = meta.license;
			source.attribution = meta.attribution;
			source.sourceUrl = meta.sourceUrl;
			source.countries = meta.countries;
			source.activities = meta.activities;
			source.status = meta.status;
			source.refreshIntervalDays = meta.refreshIntervalDays;
		}
		// Meta wins when it names a feed; an operator-set feedUrl survives
		// re-registration otherwise.
		source.feedUrl = meta.feedUrl ?? source.feedUrl;
		await this.em.persist(source).flush();
		return source;
	}

	// Scheduled refresh (the Helm CronJob's entry point): every green source
	// with a feedUrl whose lastRefreshedAt is older than its interval gets
	// re-fetched, re-parsed, and upserted. Manual sources (no feedUrl) and
	// not-yet-due sources are reported as skipped. `fetchText` is injectable
	// so tests run without network.
	async refreshDueSources(
		fetchText: (url: string) => Promise<string> = async (url) => {
			// Some providers (Overpass) 406 requests without explicit headers.
			const res = await fetch(url, {
				headers: { Accept: "application/json", "User-Agent": "routess-seeder/1.0 (+https://routess.com)" },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
			return res.text();
		},
	): Promise<RefreshRunResult[]> {
		// Self-bootstrap: every green adapter in the registry gets its SeedSource
		// row, so deploying a new adapter needs no manual registration step.
		for (const adapter of SEED_ADAPTERS) {
			if (adapter.meta.status === "green") await this.ensureSource(adapter.meta);
		}
		const sources = await this.seedSourceRepository.find({});
		const results: RefreshRunResult[] = [];
		for (const source of sources) {
			if (source.status !== "green") {
				results.push({ source: source.key, skipped: "blocked" });
				continue;
			}
			if (!source.feedUrl) {
				results.push({ source: source.key, skipped: "manual" });
				continue;
			}
			const dueAt = source.lastRefreshedAt
				? source.lastRefreshedAt.getTime() + source.refreshIntervalDays * 86_400_000
				: 0;
			if (Date.now() < dueAt) {
				results.push({ source: source.key, skipped: "not-due" });
				continue;
			}
			const adapter = seedAdapterByKey(source.key);
			if (!adapter) {
				results.push({ source: source.key, error: "no adapter registered" });
				continue;
			}
			try {
				const payload = await fetchText(source.feedUrl);
				const result = await this.upsertSeedRoutes(source.key, adapter.parse(payload));
				results.push({ source: source.key, result });
			} catch (error) {
				// One broken source must not block the rest of the run.
				results.push({ source: source.key, error: error instanceof Error ? error.message : String(error) });
			}
		}
		return results;
	}

	// Per-source inventory for the admin panel: live/removed counts, last sync,
	// and the projected next automatic sync (null for manual sources).
	async sourceStats(): Promise<SeedSourceStats[]> {
		const sources = await this.seedSourceRepository.find({}, { orderBy: { key: "ASC" } });
		return Promise.all(
			sources.map(async (source) => {
				const [routeCount, totalCount] = await Promise.all([
					this.externalRouteRepository.count({ source: source.id }),
					this.externalRouteRepository.count({ source: source.id }, { filters: { softDelete: false } }),
				]);
				const automatic = source.status === "green" && !!source.feedUrl;
				const nextRefreshAt =
					automatic && source.lastRefreshedAt
						? new Date(source.lastRefreshedAt.getTime() + source.refreshIntervalDays * 86_400_000).toISOString()
						: null;
				return {
					key: source.key,
					displayName: source.displayName,
					license: source.license,
					status: source.status,
					routeCount,
					removedCount: totalCount - routeCount,
					refreshIntervalDays: source.refreshIntervalDays,
					lastRefreshedAt: source.lastRefreshedAt?.toISOString() ?? null,
					nextRefreshAt,
					automatic,
				};
			}),
		);
	}

	// Idempotent upsert keyed on (source, sourceRecordId) (ADR 0033): insert
	// new, update changed (by content hash), revive soft-deleted, soft-delete
	// records that vanished from the source. Stable ids keep URLs stable.
	async upsertSeedRoutes(sourceKey: string, seeds: SeedRoute[]): Promise<UpsertResult> {
		const source = await this.seedSourceRepository.findOneOrFail({ key: sourceKey });
		if (source.status === "red") {
			throw new Error(`Refusing to ingest blocklisted SeedSource '${sourceKey}'`);
		}
		const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0, removed: 0 };

		// Existing rows for this source, including soft-deleted, so a returning
		// record is revived rather than duplicated.
		const existing = await this.externalRouteRepository.find({ source: source.id }, { filters: { softDelete: false } });
		const byRecordId = new Map(existing.map((r) => [r.sourceRecordId, r]));
		const seenRecordIds = new Set<string>();

		for (const rawSeed of seeds) {
			// Clamp wire-size fields; open-data names occasionally run long.
			const seed = { ...rawSeed, name: rawSeed.name.slice(0, 255), description: rawSeed.description?.slice(0, 2000) };
			seenRecordIds.add(seed.sourceRecordId);
			const hash = contentHash(seed);
			const box = routeBoundingBox(seed.geometry);
			const current = byRecordId.get(seed.sourceRecordId);
			if (!current) {
				const route = this.externalRouteRepository.create({
					name: seed.name,
					description: seed.description,
					activity: seed.activity,
					tags: seed.tags ?? [],
					geometry: seed.geometry,
					distance: seed.distance,
					bboxMinLat: box?.minLat,
					bboxMaxLat: box?.maxLat,
					bboxMinLng: box?.minLng,
					bboxMaxLng: box?.maxLng,
					source: source.id,
					sourceRecordId: seed.sourceRecordId,
					sourceUpdatedAt: seed.sourceUpdatedAt ? new Date(seed.sourceUpdatedAt) : undefined,
					contentHash: hash,
				});
				this.em.persist(route);
				result.inserted++;
				continue;
			}
			const wasDeleted = current.deletedAt != null;
			if (current.contentHash === hash && !wasDeleted) {
				result.unchanged++;
				continue;
			}
			current.name = seed.name;
			current.description = seed.description;
			current.activity = seed.activity;
			current.tags = seed.tags ?? [];
			current.geometry = seed.geometry;
			current.distance = seed.distance;
			current.bboxMinLat = box?.minLat;
			current.bboxMaxLat = box?.maxLat;
			current.bboxMinLng = box?.minLng;
			current.bboxMaxLng = box?.maxLng;
			current.sourceUpdatedAt = seed.sourceUpdatedAt ? new Date(seed.sourceUpdatedAt) : current.sourceUpdatedAt;
			current.contentHash = hash;
			current.deletedAt = undefined;
			result.updated++;
		}

		// Soft-delete records that disappeared from the source feed.
		for (const route of existing) {
			if (!seenRecordIds.has(route.sourceRecordId) && route.deletedAt == null) {
				route.deletedAt = new Date();
				result.removed++;
			}
		}

		source.lastRefreshedAt = new Date();
		await this.em.flush();
		return result;
	}

	// Read-time union helper for /routes/public: returns up to `take` external
	// summaries matching the same filters, plus the total. RoutesService merges
	// these with user-Route summaries (the ODbL Produced Work, ADR 0033).
	async findPublicMatches(
		filters: PublicListingFilters,
		gate: PublicRouteGate,
		take: number,
	): Promise<{ items: PublicRouteSummaryDto[]; total: number }> {
		const where = publicListingWhere(filters, gate) as FilterQuery<ExternalRoute>;

		if (gate === "indexable") {
			// ExternalRoutes are always public; the gate is the quality bar.
			const candidates = await this.externalRouteRepository.find(where, {
				populate: ["source"],
				orderBy: { updatedAt: "DESC" },
				limit: 5000,
			});
			const indexable = candidates.filter((r) =>
				isRouteIndexable({
					visibility: "public",
					name: r.name,
					distance: r.distance,
					description: r.description,
					tags: r.tags,
				}),
			);
			const items = indexable.slice(0, take).map((r) => toExternalRouteSummaryDto(r, { includeGeometry: false }));
			return { items, total: indexable.length };
		}

		const [rows, total] = await this.externalRouteRepository.findAndCount(where, {
			populate: ["source"],
			orderBy: { updatedAt: "DESC" },
			limit: take,
		});
		const items = rows.map((r) => toExternalRouteSummaryDto(r, { includeGeometry: true }));
		return { items, total };
	}

	async findById(id: number): Promise<ExternalRouteResponseDto> {
		const route = await this.externalRouteRepository.findOne({ id }, { populate: ["source"] });
		if (!route) {
			throw new NotFoundException(`External route ${id} not found`);
		}
		return toExternalRouteResponseDto(route);
	}

	async findEntityForGpx(id: number): Promise<ExternalRoute> {
		const route = await this.externalRouteRepository.findOne({ id }, { populate: ["source"] });
		if (!route) {
			throw new NotFoundException(`External route ${id} not found`);
		}
		return route;
	}
}
