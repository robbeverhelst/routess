import { type Rel } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from "@mikro-orm/decorators/legacy";
import type { Feature } from "../entitlements/features";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

// 'manual' is an operator grant (comp, beta access); 'billing' is written by
// the billing webhook (e.g. a one-time purchase).
export const ENTITLEMENT_SOURCES = ["manual", "billing"] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

// CONTEXT.md "Entitlement": a per-User Feature grant on top of the User's
// Plan (ADR 0039). One row per (User, Feature); revoking deletes the row,
// an expired row simply stops counting.
@Entity()
@Unique({ properties: ["user", "feature"] })
@Index({ properties: ["user"] })
export class Entitlement extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => User, { deleteRule: "cascade" })
	user!: Rel<User>;

	@Property({ type: "string" })
	feature!: Feature;

	@Property({ type: "string" })
	source!: EntitlementSource;

	// Null means the grant does not expire.
	@Property({ type: "timestamp", nullable: true })
	expiresAt?: Date;
}
