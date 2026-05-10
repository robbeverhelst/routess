import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import type { UserPreferences } from "@routess/core";
import { BaseEntity } from "./base.entity";

export type UserRole = "user" | "admin";

// 'active' is the normal state. 'pending_hard_delete' means the User has
// requested self-deletion and is in the grace window before the hard-delete
// cron purges them (ADR 0017). Distinct from admin-driven soft-delete (ADR 0016)
// which leaves deletionStatus = 'active' and is reversible by relogin.
export type UserDeletionStatus = "active" | "pending_hard_delete";

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

	@Property({ nullable: true })
	avatar?: string;

	@Property({ default: false })
	isEmailVerified = false;

	@Property({ type: "string", default: "user" })
	role: UserRole = "user";

	@Property({ type: "json", nullable: true })
	preferences?: UserPreferences | null;

	@Property({ type: "string", default: "active" })
	deletionStatus: UserDeletionStatus = "active";

	@Property({ type: "timestamp", nullable: true })
	deletionRequestedAt?: Date;
}
