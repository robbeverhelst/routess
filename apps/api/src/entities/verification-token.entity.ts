import { Entity, Index, ManyToOne, PrimaryKey, Property, type Ref } from "@mikro-orm/core";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

// Used by both pending email signups and password reset flows.
// 'pending_signup'      → no User row yet; carries email + passwordHash, becomes
//                         a User + UserAuthMethod when the link is clicked.
// 'password_reset'      → existing User; consuming the token swaps the hash
//                         and revokes all sessions.
export type VerificationTokenPurpose = "pending_signup" | "password_reset";

@Entity({ tableName: "verification_token" })
@Index({ properties: ["token"] })
@Index({ properties: ["email"] })
export class VerificationToken extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@Property({ type: "string", unique: true })
	token!: string;

	@Property({ type: "string" })
	purpose!: VerificationTokenPurpose;

	@Property({ type: "string" })
	email!: string;

	@ManyToOne(() => User, { nullable: true, deleteRule: "cascade" })
	user?: Ref<User>;

	// Argon2id hash for pending_signup; null for password_reset (the new hash
	// arrives with the consume request, not stored ahead of time).
	@Property({ type: "string", hidden: true, nullable: true })
	passwordHash?: string;

	@Property({ type: "timestamp" })
	expiresAt!: Date;

	@Property({ type: "timestamp", nullable: true })
	usedAt?: Date;
}
