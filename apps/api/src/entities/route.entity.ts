import { type Opt, type Ref } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type { Provenance, RouteActivity, RouteVisibility, RoutingPreferences, Waypoint } from "@routess/core";
import { generateShareToken } from "../common/share-token";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

export type { Provenance, RouteActivity, RouteVisibility, RoutingPreferences, Waypoint } from "@routess/core";

@Entity()
@Index({ properties: ["user"] })
@Index({ properties: ["createdAt"] })
@Index({ properties: ["user", "createdAt"] })
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

	@Property({ nullable: true })
	startAddress?: string;

	@Property({ nullable: true })
	endAddress?: string;

	// Inputs that produced this Route's geometry. Null for legacy / GPX-imported
	// routes that have no recorded inputs. See CONTEXT.md "RoutingPreferences".
	@Property({ type: "json", nullable: true })
	routingPreferences?: RoutingPreferences | null;

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
