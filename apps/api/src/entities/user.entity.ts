import { randomBytes } from "node:crypto";
import { type Opt } from "@mikro-orm/core";
import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type { UserPreferences } from "@routess/core";
import { BaseEntity } from "./base.entity";

export function randomHandle(): string {
	return `user-${randomBytes(4).toString("hex")}`;
}

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// CONTEXT.md "Plan". What a hosted User is on; the Features and the
// generation quota each Plan gets live in entitlements/features.ts and the
// quota config (ADR 0039).
export const USER_PLANS = ["free", "pro"] as const;
export type UserPlan = (typeof USER_PLANS)[number];

// 'active' is the normal state. 'pending_hard_delete' means the User has
// requested self-deletion and is in the grace window before the hard-delete
// cron purges them (ADR 0017). Distinct from admin-driven soft-delete (ADR 0016)
// which leaves deletionStatus = 'active' and is reversible by relogin.
export const USER_DELETION_STATUSES = ["active", "pending_hard_delete"] as const;
export type UserDeletionStatus = (typeof USER_DELETION_STATUSES)[number];

@Entity()
@Index({ properties: ["email"] })
@Index({ properties: ["deletionStatus", "deletionRequestedAt"] })
export class User extends BaseEntity {
	@PrimaryKey({ type: "number" })
	id!: number;

	@Property({ unique: true })
	email!: string;

	@Property()
	name!: string;

	// Public address of the User's Profile (CONTEXT.md "Handle"). Generated at
	// signup from the display name (never the email); the onCreate fallback
	// keeps fixtures and edge paths valid with a random handle.
	@Property({ unique: true, onCreate: (user: User) => user.handle ?? randomHandle() })
	handle!: string & Opt;

	@Property({ nullable: true })
	avatar?: string;

	@Property({ default: false })
	isEmailVerified = false;

	@Property({ type: "string", default: "user" })
	role: UserRole = "user";

	// The stored Plan, never written by the browser. 'pro' here is a permanent
	// comp an operator sets; paid passes and the OG grant are Plan
	// Entitlements on top of it (ADR 0039).
	@Property({ type: "string", default: "free" })
	plan: UserPlan & Opt = "free";

	@Property({ type: "json", nullable: true })
	preferences?: UserPreferences | null;

	@Property({ type: "string", default: "active" })
	deletionStatus: UserDeletionStatus = "active";

	@Property({ type: "timestamp", nullable: true })
	deletionRequestedAt?: Date;

	// Bell-badge watermark (CONTEXT.md "NotificationsSeenAt"): Notification
	// items newer than this are unseen. Distinct from RouteShare.readAt.
	@Property({ type: "timestamp", nullable: true })
	notificationsSeenAt?: Date;
}
