import { EntityManager, Reference } from "@mikro-orm/core";
import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { type Provenance, routeBoundingBox } from "@routess/core";

import { ExternalRoute } from "../entities/external-route.entity";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { PlacesService } from "../places/places.service";
import { ROUTE_CREATED, type RouteCreatedEvent } from "../telemetry/domain-events";
import type { CreateRouteDto } from "./dto/create-route.dto";
import { SurfaceCompositionService } from "./surface-composition.service";

/** What a client sends for a new Route; how it came to exist is the RouteOrigin. */
export type RouteInput = Omit<CreateRouteDto, "provenance" | "forkedFromExternalRouteId">;

/**
 * How a new Route came to exist, which decides its Provenance and lineage:
 * - draft: composed in a client (planner, generation, GPX import).
 * - fork: geometry taken from an ExternalRoute (ADR 0035).
 * - copy: "save a copy" of another User's shared Route.
 */
export type RouteOrigin =
	| { kind: "draft"; input: RouteInput; provenance?: Exclude<Provenance, "external-fork"> }
	| { kind: "fork"; input: RouteInput; externalRouteId: number }
	| { kind: "copy"; source: Route };

// The one place a Route is created (ADR 0011, amended). It owns the
// invariants every new Route must meet whatever its origin: Provenance and
// lineage, the inherited license on forks and their copies, the default
// visibility, PublishedAt, the bounding box, the saved-route allowance, the
// creation event and the Place and surface derivations.
@Injectable()
export class RouteWriter {
	constructor(
		private readonly em: EntityManager,
		private readonly events: EventEmitter2,
		private readonly entitlements: EntitlementsService,
		private readonly places: PlacesService,
		private readonly surfaces: SurfaceCompositionService,
	) {}

	async create(ownerId: number, origin: RouteOrigin): Promise<Route> {
		const data = await this.routeData(ownerId, origin);
		// Free saves up to FREE_SAVED_ROUTE_LIMIT Routes (ADR 0039). The Route
		// is built inside the gate so the count never sees it.
		const route = await this.entitlements.saveWithinRouteAllowance({ id: ownerId }, async (em) => {
			const route = em.create(Route, { ...data, user: ownerId });
			if (route.visibility === "public") {
				route.publishedAt = new Date();
			}
			applyBbox(route);
			await em.persist(route).flush();
			return route;
		});
		await this.em.populate(route, ["user"]);

		// A copy carries its source's Place and is private, so it skips the
		// creation event and the derivations, as "save a copy" always has.
		if (origin.kind !== "copy") {
			this.events.emit(ROUTE_CREATED, { userId: ownerId } satisfies RouteCreatedEvent);
			// Fire-and-forget: Place is async and fail-open (CONTEXT.md "Place").
			void this.places.derivePlaceForRoute(route.id);
			// Same pattern for the persisted surface composition (ADR 0032).
			void this.surfaces.deriveForRoute(route.id);
		}
		return route;
	}

	private async routeData(ownerId: number, origin: RouteOrigin) {
		switch (origin.kind) {
			case "draft": {
				const owner = await this.em.findOneOrFail(User, { id: ownerId });
				return {
					...clientFields(origin.input),
					visibility: origin.input.visibility ?? owner.preferences?.defaultRouteVisibility ?? "private",
					provenance: origin.provenance ?? "valhalla",
				};
			}
			case "fork": {
				// A source that has since vanished upstream is soft-deleted, not
				// gone: its license still applies, so the lookup sees it too.
				const external = await this.em.findOne(
					ExternalRoute,
					{ id: origin.externalRouteId },
					{ populate: ["source"], filters: false },
				);
				if (!external) throw new NotFoundException("External route not found");
				// The relation is not declared `ref: true`, so once populated it
				// holds the SeedSource itself rather than a Reference wrapper.
				const source = Reference.unwrapReference(external.source);
				return {
					...clientFields(origin.input),
					// Forks are private unless the user chooses otherwise (ADR 0035).
					visibility: origin.input.visibility ?? "private",
					provenance: "external-fork" as const,
					forkedFromExternalRouteId: external.id,
					sourceLicense: source.license,
					sourceAttribution: source.attribution,
				};
			}
			case "copy": {
				const { source } = origin;
				return {
					name: source.name,
					description: source.description,
					activity: source.activity,
					visibility: "private" as const,
					tags: [...source.tags],
					favourite: false,
					waypoints: structuredClone(source.waypoints),
					geometry: source.geometry ? structuredClone(source.geometry) : undefined,
					distance: source.distance,
					duration: source.duration,
					elevationGain: source.elevationGain,
					placeCity: source.placeCity,
					placeRegion: source.placeRegion,
					placeCountryCode: source.placeCountryCode,
					startAddress: source.startAddress,
					endAddress: source.endAddress,
					routingPreferences: source.routingPreferences ?? null,
					// Provenance describes how the geometry was made, not how it
					// arrived, so a copy keeps it, and a fork's license with it.
					provenance: source.provenance,
					forkedFromExternalRouteId: source.forkedFromExternalRouteId,
					sourceLicense: source.sourceLicense,
					sourceAttribution: source.sourceAttribution,
					copiedFromRouteId: source.id,
					copiedFromUserId: source.user.id,
				};
			}
		}
	}
}

function clientFields(input: RouteInput) {
	return {
		...input,
		tags: input.tags ?? [],
		favourite: input.favourite ?? false,
	};
}

// The persisted bbox (ADR 0030), from the route's geometry, falling back to
// waypoint coords for direct-only routes. Recomputed on every geometry change.
export function applyBbox(route: Route): void {
	const coords = route.geometry?.length ? route.geometry : route.waypoints.map((w) => w.coord);
	const box = routeBoundingBox(coords);
	route.bboxMinLat = box?.minLat;
	route.bboxMaxLat = box?.maxLat;
	route.bboxMinLng = box?.minLng;
	route.bboxMaxLng = box?.maxLng;
}
