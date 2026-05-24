import { Entity, Index, ManyToOne, PrimaryKey, Property, type Ref } from "@mikro-orm/core";
import type { Provenance, RouteActivity, RouteVisibility, RoutingPreferences, Waypoint } from "@routess/core";
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

	@ManyToOne(() => User)
	user!: Ref<User>;
}
