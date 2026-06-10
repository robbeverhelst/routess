import { type Rel } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import { BaseEntity } from "./base.entity";
import { Route } from "./route.entity";
import { User } from "./user.entity";

// Deliberate person-to-person delivery of a Route (CONTEXT.md "RouteShare").
// Only carries unlisted/public Routes and grants no access of its own
// (ADR 0027): the inbox entry is a live reference, so a Route flipped back to
// private shows as "no longer available" rather than leaking.
@Entity()
@Index({ properties: ["recipient", "createdAt"] })
@Index({ properties: ["sender"] })
@Index({ properties: ["route"] })
export class RouteShare extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => User, { deleteRule: "cascade" })
	sender!: Rel<User>;

	@ManyToOne(() => User, { deleteRule: "cascade" })
	recipient!: Rel<User>;

	@ManyToOne(() => Route, { deleteRule: "cascade" })
	route!: Rel<Route>;

	@Property({ nullable: true, length: 500 })
	message?: string;

	@Property({ type: "timestamp", nullable: true })
	readAt?: Date;

	// When the share notification email went out; null when skipped (opt-out
	// or the per sender→recipient hourly rate limit).
	@Property({ type: "timestamp", nullable: true })
	emailedAt?: Date;
}
