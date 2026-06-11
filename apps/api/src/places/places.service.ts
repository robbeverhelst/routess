import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { routeBoundingBox } from "@routess/core";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { ExternalRoute } from "../entities/external-route.entity";
import { GeocodeCache } from "../entities/geocode-cache.entity";
import { Route } from "../entities/route.entity";
import { MetricsService } from "../telemetry/metrics.service";

export interface DerivedPlace {
	city: string;
	region?: string;
	countryCode?: string;
}

interface GeocodeFeature {
	text?: string;
	place_type?: string[];
	context?: { id: string; text?: string; short_code?: string }[];
}

// Derives a Route's Place (CONTEXT.md) by reverse-geocoding the RoutePath
// start. Fail-open by design: any error leaves the Place null; the backfill
// script is the retry path.
@Injectable()
export class PlacesService {
	private readonly logger = new Logger(PlacesService.name);

	constructor(
		private readonly em: EntityManager,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly metrics: MetricsService,
	) {}

	get enabled(): boolean {
		return this.config.geocoding.mapboxToken.length > 0;
	}

	// Geocode results for a ~100m grid cell never change, so they live in a
	// durable Postgres cache rather than a TTL store (ADR 0032). The cell key
	// rounds to 3 decimals (~110m latitude).
	private geocodeCacheKey([lng, lat]: [number, number]): string {
		return `${lat.toFixed(3)},${lng.toFixed(3)}`;
	}

	async reverseGeocodePlace(start: [number, number]): Promise<DerivedPlace | null> {
		if (!this.enabled) return null;

		const key = this.geocodeCacheKey(start);
		const em = this.em.fork();
		try {
			const cached = await em.findOne(GeocodeCache, { key });
			this.metrics.recordCacheEvent("geocode", cached ? "hit" : "miss");
			if (cached) {
				return { city: cached.city, region: cached.region, countryCode: cached.countryCode };
			}
		} catch (error) {
			this.logger.warn(`Geocode cache lookup failed: ${error instanceof Error ? error.message : String(error)}`);
		}

		const place = await this.reverseGeocodeFromMapbox(start);
		if (place) {
			try {
				// Parallel derivations can race on the same cell; first write wins.
				await em.upsert(GeocodeCache, { key, ...place, createdAt: new Date() });
			} catch (error) {
				this.logger.warn(`Geocode cache write failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return place;
	}

	// Mapbox geocoding v5: the 'place' feature is the city; region and country
	// come from its context. The token is URL-restricted, hence the Referer.
	private async reverseGeocodeFromMapbox(start: [number, number]): Promise<DerivedPlace | null> {
		const [lng, lat] = start;
		const url =
			`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
			`?types=place&limit=1&access_token=${this.config.geocoding.mapboxToken}`;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		try {
			const res = await fetch(url, {
				headers: { Referer: this.config.geocoding.referer },
				signal: controller.signal,
			});
			this.metrics.recordProviderCall("mapbox", "/geocoding/v5", "places", res.ok ? "success" : "error");
			if (!res.ok) {
				this.logger.warn(`Reverse geocode failed with status ${res.status}`);
				return null;
			}
			const data = (await res.json()) as { features?: GeocodeFeature[] };
			const feature = data.features?.[0];
			const city = feature?.text?.trim();
			if (!city) return null;
			const region = feature?.context?.find((c) => c.id.startsWith("region."))?.text?.trim();
			const countryCode = feature?.context
				?.find((c) => c.id.startsWith("country."))
				?.short_code?.toUpperCase()
				.slice(0, 2);
			return { city, region, countryCode };
		} catch (error) {
			this.metrics.recordProviderCall("mapbox", "/geocoding/v5", "places", "error");
			this.logger.warn(`Reverse geocode error: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		} finally {
			clearTimeout(timeout);
		}
	}

	// Idempotent backfill (#233): fills bbox and Place wherever they are null.
	// Only touches missing fields, so it doubles as the retry path for failed
	// async derivations. Throttled to stay under the Mapbox rate limit.
	async backfillMissing(options: { geocodeDelayMs?: number } = {}): Promise<{ boxed: number; placed: number }> {
		const delay = options.geocodeDelayMs ?? 150;
		const em = this.em.fork();
		const routes = await em.find(Route, { $or: [{ placeCity: null }, { bboxMinLat: null }] });
		let boxed = 0;
		let placed = 0;
		for (const route of routes) {
			const coords = route.geometry?.length ? route.geometry : route.waypoints.map((w) => w.coord);
			if (route.bboxMinLat == null) {
				const box = routeBoundingBox(coords);
				if (box) {
					route.bboxMinLat = box.minLat;
					route.bboxMaxLat = box.maxLat;
					route.bboxMinLng = box.minLng;
					route.bboxMaxLng = box.maxLng;
					boxed++;
				}
			}
			if (!route.placeCity && this.enabled && coords[0]) {
				const place = await this.reverseGeocodePlace(coords[0]);
				if (place) {
					route.placeCity = place.city;
					route.placeRegion = place.region;
					route.placeCountryCode = place.countryCode;
					placed++;
				}
				if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
		await em.flush();
		return { boxed, placed };
	}

	// Same idempotent backfill for the ExternalRoute layer (ADR 0035): seeded
	// routes need a Place to count toward RegionalHubs (#236). Geometry is the
	// whole record there, so only the Place part applies (bbox is set on
	// upsert). Fail-open like everything else here.
	async backfillExternalMissing(options: { geocodeDelayMs?: number } = {}): Promise<{ placed: number }> {
		if (!this.enabled) return { placed: 0 };
		const delay = options.geocodeDelayMs ?? 150;
		const em = this.em.fork();
		const routes = await em.find(ExternalRoute, { placeCity: null });
		let placed = 0;
		for (const route of routes) {
			const start = route.geometry[0];
			if (!start) continue;
			const place = await this.reverseGeocodePlace(start);
			if (place) {
				route.placeCity = place.city;
				route.placeRegion = place.region;
				route.placeCountryCode = place.countryCode;
				placed++;
			}
			if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
		}
		await em.flush();
		return { placed };
	}

	// Fire-and-forget entry point used after route saves. Forks the EM so it is
	// safe to run after the request context that triggered it has closed.
	async derivePlaceForRoute(routeId: number): Promise<void> {
		if (!this.enabled) return;
		try {
			const em = this.em.fork();
			const route = await em.findOne(Route, { id: routeId });
			const start = route?.geometry?.[0] ?? route?.waypoints?.[0]?.coord;
			if (!route || !start) return;
			const place = await this.reverseGeocodePlace(start);
			if (!place) return;
			route.placeCity = place.city;
			route.placeRegion = place.region;
			route.placeCountryCode = place.countryCode;
			await em.persist(route).flush();
		} catch (error) {
			this.logger.warn(
				`Place derivation failed for route ${routeId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
