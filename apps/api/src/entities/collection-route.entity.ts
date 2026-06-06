import { type Rel } from "@mikro-orm/core";
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from "@mikro-orm/decorators/legacy";
import { Collection } from "./collection.entity";
import { Route } from "./route.entity";

@Entity()
@Unique({ properties: ["collection", "route"] })
export class CollectionRoute {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => Collection, { deleteRule: "cascade" })
	collection!: Rel<Collection>;

	@ManyToOne(() => Route, { deleteRule: "cascade" })
	route!: Route;

	@Property()
	position!: number;
}
