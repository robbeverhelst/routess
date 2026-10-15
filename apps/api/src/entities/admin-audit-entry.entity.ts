import { type Rel } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

export const ADMIN_AUDIT_ACTIONS = ["pro.grant", "pro.extend", "pro.revoke"] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

// CONTEXT.md "AdminAuditEntry": one admin action that changed a User's state,
// with who did it, when, what changed and the reason the admin gave. Every
// admin request is also logged through Pino (AuditInterceptor, ADR-0015);
// this row is the durable, queryable trail for actions that change a User's
// Plan. The row outlives both Users: deleting either only clears the link,
// and the actor's email is kept as written.
@Entity()
@Index({ properties: ["targetUser", "createdAt"] })
export class AdminAuditEntry extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => User, { nullable: true, deleteRule: "set null" })
	actor?: Rel<User> | null;

	@Property({ type: "string" })
	actorEmail!: string;

	@Property({ type: "string" })
	action!: AdminAuditAction;

	@ManyToOne(() => User, { nullable: true, deleteRule: "set null" })
	targetUser?: Rel<User> | null;

	// What changed: the action's input and the before/after state.
	@Property({ type: "json" })
	details!: Record<string, unknown>;

	@Property({ type: "text" })
	reason!: string;
}
