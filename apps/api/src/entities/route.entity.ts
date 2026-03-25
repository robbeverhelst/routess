import { Entity, Index, ManyToOne, PrimaryKey, Property, type Ref } from "@mikro-orm/core";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

export interface Waypoint {
	lat: number;
	lng: number;
	type?: "routed" | "direct";
	timestamp?: string;
}

@Entity()
@Index({ properties: ["user"] }) // Index for user-based route lookups
@Index({ properties: ["createdAt"] }) // Index for chronological sorting
@Index({ properties: ["user", "createdAt"] }) // Composite index for user routes by date
export class Route extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@Property()
	name!: string;

	@Property({ nullable: true })
	description?: string;

	@Property({ type: "json" })
	waypoints!: Waypoint[];

	@Property({ type: "float", nullable: true })
	distance?: number; // in kilometers

	@ManyToOne(() => User)
	user!: Ref<User>;
}
