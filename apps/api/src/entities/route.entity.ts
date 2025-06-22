import { Entity, PrimaryKey, Property, ManyToOne, type Ref } from "@mikro-orm/core";
import { User } from "./user.entity";

export interface Waypoint {
  lat: number;
  lng: number;
  type: "routed" | "direct";
}

@Entity()
export class Route {
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

  @Property()
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
