import { describe, expect, it } from "bun:test";

import type { EntityManager } from "@mikro-orm/core";
import { NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ExternalRoute } from "src/entities/external-route.entity";
import { Route } from "src/entities/route.entity";
import type { User } from "src/entities/user.entity";
import type { EntitlementsService } from "src/entitlements/entitlements.service";
import type { PlacesService } from "src/places/places.service";
import { type RouteInput, RouteWriter } from "src/routes/route-writer";
import type { SurfaceCompositionService } from "src/routes/surface-composition.service";
import { ROUTE_CREATED } from "src/telemetry/domain-events";

// RouteWriter through its interface, one test group per RouteOrigin, on an
// in-memory EntityManager. The real database path runs in the integration
// suite (POST /routes, share copies).

const INPUT: RouteInput = {
	name: "Scheldt loop",
	activity: "cycle",
	waypoints: [
		{ coord: [3.7, 51.05], type: "routed" },
		{ coord: [3.8, 51.1], type: "routed" },
	],
	geometry: [
		[3.7, 51.05],
		[3.75, 51.2],
		[3.8, 51.1],
	],
	distance: 12_000,
	elevationGain: 40,
};

interface Harness {
	writer: RouteWriter;
	saved: Route[];
	created: number[];
	derivedPlaces: number[];
	derivedSurfaces: number[];
	externalLookups: unknown[];
}

function makeWriter(
	options: { ownerVisibility?: "private" | "public"; external?: ExternalRoute | null } = {},
): Harness {
	const saved: Route[] = [];
	const externalLookups: unknown[] = [];
	const owner = { id: 7, preferences: { defaultRouteVisibility: options.ownerVisibility ?? "private" } } as User;
	let nextId = 100;
	const em = {
		findOneOrFail: async () => owner,
		findOne: async (entity: unknown, _where: unknown, findOptions: unknown) => {
			if (entity !== ExternalRoute) throw new Error("unexpected lookup");
			externalLookups.push(findOptions);
			return options.external ?? null;
		},
		create: (_entity: unknown, data: Record<string, unknown>) => {
			const { user, ...rest } = data;
			return Object.assign(new Route(), rest, { user: { id: user } });
		},
		persist: (route: Route) => ({
			flush: async () => {
				route.id = nextId++;
				saved.push(route);
			},
		}),
		populate: async () => undefined,
	} as unknown as EntityManager;
	const entitlements = {
		saveWithinRouteAllowance: (_user: unknown, save: (em: EntityManager) => Promise<unknown>) => save(em),
	} as unknown as EntitlementsService;
	const derivedPlaces: number[] = [];
	const derivedSurfaces: number[] = [];
	const places = { derivePlaceForRoute: async (id: number) => void derivedPlaces.push(id) } as unknown as PlacesService;
	const surfaces = {
		deriveForRoute: async (id: number) => void derivedSurfaces.push(id),
	} as unknown as SurfaceCompositionService;
	const events = new EventEmitter2();
	const created: number[] = [];
	events.on(ROUTE_CREATED, (event: { userId: number }) => created.push(event.userId));
	const writer = new RouteWriter(em, events, entitlements, places, surfaces);
	return { writer, saved, created, derivedPlaces, derivedSurfaces, externalLookups };
}

function externalRoute(id: number): ExternalRoute {
	const source = { license: "ODbL-1.0", attribution: "© EuroVelo, OpenStreetMap contributors" };
	return Object.assign(new ExternalRoute(), { id, source });
}

describe("RouteWriter: draft", () => {
	it("defaults Provenance to valhalla and visibility to the owner's default", async () => {
		const h = makeWriter({ ownerVisibility: "public" });

		const route = await h.writer.create(7, { kind: "draft", input: INPUT });

		expect(route.provenance).toBe("valhalla");
		expect(route.visibility).toBe("public");
		expect(route.publishedAt).toBeInstanceOf(Date);
		expect(route.tags).toEqual([]);
		expect(route.favourite).toBe(false);
		expect(route.forkedFromExternalRouteId).toBeUndefined();
	});

	it("keeps the draft's Provenance and derives the bounding box from the geometry", async () => {
		const h = makeWriter();

		const route = await h.writer.create(7, { kind: "draft", input: INPUT, provenance: "generation" });

		expect(route.provenance).toBe("generation");
		expect(route.visibility).toBe("private");
		expect(route.publishedAt).toBeUndefined();
		expect([route.bboxMinLat, route.bboxMaxLat, route.bboxMinLng, route.bboxMaxLng]).toEqual([51.05, 51.2, 3.7, 3.8]);
	});

	it("emits the creation event and queues the Place and surface derivations", async () => {
		const h = makeWriter();

		const route = await h.writer.create(7, { kind: "draft", input: INPUT });

		expect(h.created).toEqual([7]);
		expect(h.derivedPlaces).toEqual([route.id]);
		expect(h.derivedSurfaces).toEqual([route.id]);
	});
});

describe("RouteWriter: fork", () => {
	it("sets external-fork, the lineage and the inherited license", async () => {
		const h = makeWriter({ ownerVisibility: "public", external: externalRoute(42) });

		const route = await h.writer.create(7, { kind: "fork", input: INPUT, externalRouteId: 42 });

		expect(route.provenance).toBe("external-fork");
		expect(route.forkedFromExternalRouteId).toBe(42);
		expect(route.sourceLicense).toBe("ODbL-1.0");
		expect(route.sourceAttribution).toBe("© EuroVelo, OpenStreetMap contributors");
		expect(h.created).toEqual([7]);
		expect(h.derivedPlaces).toEqual([route.id]);
	});

	it("is private by default, whatever the owner's default visibility", async () => {
		const h = makeWriter({ ownerVisibility: "public", external: externalRoute(42) });

		const route = await h.writer.create(7, { kind: "fork", input: INPUT, externalRouteId: 42 });

		expect(route.visibility).toBe("private");
		expect(route.publishedAt).toBeUndefined();
	});

	it("honours a visibility the user chose", async () => {
		const h = makeWriter({ external: externalRoute(42) });

		const route = await h.writer.create(7, {
			kind: "fork",
			input: { ...INPUT, visibility: "public" },
			externalRouteId: 42,
		});

		expect(route.visibility).toBe("public");
		expect(route.publishedAt).toBeInstanceOf(Date);
	});

	it("finds a source that vanished upstream, since its license still applies", async () => {
		const h = makeWriter({ external: externalRoute(42) });

		await h.writer.create(7, { kind: "fork", input: INPUT, externalRouteId: 42 });

		expect(h.externalLookups).toEqual([{ populate: ["source"], filters: false }]);
	});

	it("refuses a fork of an unknown ExternalRoute and saves nothing", async () => {
		const h = makeWriter({ external: null });

		await expect(h.writer.create(7, { kind: "fork", input: INPUT, externalRouteId: 404 })).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(h.saved).toHaveLength(0);
	});
});

describe("RouteWriter: copy", () => {
	function sourceRoute(overrides: Partial<Route> = {}): Route {
		return Object.assign(new Route(), {
			id: 9,
			name: "Shared loop",
			activity: "walk",
			visibility: "public",
			tags: ["scenic"],
			favourite: true,
			waypoints: INPUT.waypoints,
			geometry: INPUT.geometry,
			distance: 12_000,
			placeCity: "Gent",
			provenance: "generation",
			user: { id: 3 },
			...overrides,
		});
	}

	it("keeps Provenance, records lineage and starts private", async () => {
		const h = makeWriter({ ownerVisibility: "public" });
		const source = sourceRoute();

		const copy = await h.writer.create(7, { kind: "copy", source });

		expect(copy.provenance).toBe("generation");
		expect(copy.copiedFromRouteId).toBe(9);
		expect(copy.copiedFromUserId).toBe(3);
		expect(copy.visibility).toBe("private");
		expect(copy.favourite).toBe(false);
		expect(copy.placeCity).toBe("Gent");
		expect(copy.tags).toEqual(["scenic"]);
		expect(copy.tags).not.toBe(source.tags);
		expect(copy.geometry).not.toBe(source.geometry);
	});

	it("carries a fork's lineage and license onto the copy", async () => {
		const h = makeWriter();
		const source = sourceRoute({
			provenance: "external-fork",
			forkedFromExternalRouteId: 42,
			sourceLicense: "ODbL-1.0",
			sourceAttribution: "© EuroVelo",
		});

		const copy = await h.writer.create(7, { kind: "copy", source });

		expect(copy.provenance).toBe("external-fork");
		expect(copy.forkedFromExternalRouteId).toBe(42);
		expect(copy.sourceLicense).toBe("ODbL-1.0");
		expect(copy.sourceAttribution).toBe("© EuroVelo");
	});

	it("skips the creation event and derivations, keeping the source's Place", async () => {
		const h = makeWriter();

		await h.writer.create(7, { kind: "copy", source: sourceRoute() });

		expect(h.created).toEqual([]);
		expect(h.derivedPlaces).toEqual([]);
		expect(h.derivedSurfaces).toEqual([]);
	});
});
