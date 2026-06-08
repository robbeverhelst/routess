import { type Opt, type Ref } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type {
	Provenance,
	RouteActivity,
	RouteVisibility,
	RoutingPreferences,
	SurfaceComposition,
	Waypoint,
} from "@routess/core";
import { generateShareToken } from "../common/share-token";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

export type { Provenance, RouteActivity, RouteVisibility, RoutingPreferences, Waypoint } from "@routess/core";

@Entity()
@Index({ properties: ["user"] })
@Index({ properties: ["createdAt"] })
@Index({ properties: ["user", "createdAt"] })
@Index({ properties: ["visibility", "publishedAt"] })
@Index({ properties: ["placeCity"] })
export class Route extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@Property()
	name!: string;

	@Property({ nullable: true })
	description?: string;

	@Property({ type: "string", nullable: true })
	activity?: RouteActivity;

	@Property({ type: "string", default: "private" })
	visibility: RouteVisibility = "private";

	@Property({ type: "json" })
	tags: string[] = [];

	@Property({ default: false })
	favourite = false;

	@Property({ type: "json" })
	waypoints!: Waypoint[];

	@Property({ type: "json", nullable: true })
	geometry?: [number, number][];

	@Property({ type: "float", nullable: true })
	distance?: number;

	@Property({ type: "integer", nullable: true })
	duration?: number;

	@Property({ type: "float", nullable: true })
	elevationGain?: number;

	// Bounding box of the RoutePath, recomputed on every save with geometry.
	// Plain float columns instead of PostGIS by design; see ADR 0030.
	@Property({ type: "float", nullable: true })
	bboxMinLat?: number;

	@Property({ type: "float", nullable: true })
	bboxMaxLat?: number;

	@Property({ type: "float", nullable: true })
	bboxMinLng?: number;

	@Property({ type: "float", nullable: true })
	bboxMaxLng?: number;

	// Place: locality derived by reverse-geocoding the RoutePath start, async
	// and fail-open (CONTEXT.md "Place"). Never user-edited, unlike startAddress.
	@Property({ nullable: true })
	placeCity?: string;

	@Property({ nullable: true })
	placeRegion?: string;

	@Property({ nullable: true })
	placeCountryCode?: string;

	@Property({ nullable: true })
	startAddress?: string;

	@Property({ nullable: true })
	endAddress?: string;

	// Inputs that produced this Route's geometry. Null for legacy / GPX-imported
	// routes that have no recorded inputs. See CONTEXT.md "RoutingPreferences".
	@Property({ type: "json", nullable: true })
	routingPreferences?: RoutingPreferences | null;

	// SurfaceBuckets along the RoutePath, derived once at save (async,
	// fail-open, like Place) so viewing a Route makes zero provider calls.
	// Cleared whenever the geometry changes. See ADR 0032.
	@Property({ type: "json", nullable: true })
	surfaceComposition?: SurfaceComposition | null;

	// How this Route came to exist. Immutable after creation. See CONTEXT.md.
	@Property({ type: "string", default: "valhalla" })
	provenance: Provenance = "valhalla";

	// Unguessable handle for share links (32 hex chars). Unlisted routes are
	// only reachable anonymously through this token; numeric ids would be
	// enumerable, which defeats the "only people with the link" tier.
	@Property({ type: "string", unique: true })
	shareToken: string & Opt = generateShareToken();

	// Set on the first transition to 'public', never bumped (CONTEXT.md
	// "PublishedAt"); re-publishing restores feed position rather than topping.
	@Property({ type: "timestamp", nullable: true })
	publishedAt?: Date;

	// Lineage when this Route was saved as a copy of a shared Route.
	@Property({ nullable: true })
	copiedFromRouteId?: number;

	@Property({ nullable: true })
	copiedFromUserId?: number;

	@ManyToOne(() => User)
	user!: Ref<User>;
}
