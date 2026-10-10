import { type Rel } from "@mikro-orm/core";
import { Check, Entity, ManyToOne, PrimaryKey, Property, Unique } from "@mikro-orm/decorators/legacy";
import type { Feature } from "../entitlements/features";
import { BaseEntity } from "./base.entity";
import type { UserPlan } from "./user.entity";
import { User } from "./user.entity";

// 'manual' is an operator grant (comp, beta access); 'billing' is written by
// the billing webhook (a paid Pro pass); 'og-grant' is the one-time Pro grant
// for accounts that predate the billing launch (ADR 0039).
export const ENTITLEMENT_SOURCES = ["manual", "billing", "og-grant"] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

// CONTEXT.md "Entitlement": a per-User grant on top of the User's Plan (ADR
// 0039). A row grants either one Feature or the whole Pro Plan (a Pro pass or
// the OG grant), never both. One Feature row per (User, Feature) and one Plan
// row per (User, Plan, source); revoking deletes the row, an expired row
// simply stops counting.
@Entity()
@Unique({ properties: ["user", "feature"] })
@Unique({ properties: ["user", "plan", "source"] })
@Check({ name: "entitlement_feature_or_plan_check", expression: "(feature is null) <> (plan is null)" })
export class Entitlement extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => User, { deleteRule: "cascade" })
	user!: Rel<User>;

	@Property({ type: "string", nullable: true })
	feature?: Feature | null;

	@Property({ type: "string", nullable: true })
	plan?: UserPlan | null;

	@Property({ type: "string" })
	source!: EntitlementSource;

	// Null means the grant does not expire.
	@Property({ type: "timestamp", nullable: true })
	expiresAt?: Date | null;
}
