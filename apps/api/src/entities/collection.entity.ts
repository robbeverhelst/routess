import {
	Entity,
	Index,
	ManyToOne,
	OneToMany,
	type Opt,
	Collection as OrmCollection,
	PrimaryKey,
	Property,
	type Ref,
} from "@mikro-orm/core";
import type { RouteVisibility } from "@routess/core";
import { generateShareToken } from "../common/share-token";
import { BaseEntity } from "./base.entity";
import { CollectionRoute } from "./collection-route.entity";
import { User } from "./user.entity";

// A curated, manually ordered set of Routes (see CONTEXT.md "Collection").
// Routes and Collections are many-to-many via CollectionRoute, which carries
// the position within the collection.
@Entity()
@Index({ properties: ["user"] })
export class Collection extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@Property()
	name!: string;

	@Property({ nullable: true })
	description?: string;

	@Property({ type: "string", default: "private" })
	visibility: RouteVisibility = "private";

	// Unguessable handle for share links (32 hex chars); see Route.shareToken.
	@Property({ type: "string", unique: true })
	shareToken: string & Opt = generateShareToken();

	@ManyToOne(() => User)
	user!: Ref<User>;

	@OneToMany(
		() => CollectionRoute,
		(cr) => cr.collection,
		{ orphanRemoval: true },
	)
	routes = new OrmCollection<CollectionRoute>(this);
}
