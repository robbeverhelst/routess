import { type Opt, type Ref } from "@mikro-orm/core";
import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from "@mikro-orm/decorators/legacy";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

// Way a User proves their identity. A User has one or more methods. Adding a
// second method to an existing User happens from settings (no email
// verification round-trip needed since the user is already signed in via
// another method that proved email control). Fresh signups via email+password
// require email verification before the password becomes active.
//
// 'google'  → providerId is the Google `sub` claim. passwordHash is null.
// 'email'   → providerId is the lowercased email (matches User.email).
//             passwordHash holds an argon2id hash; null until verification.
export type AuthProvider = "google" | "email";

@Entity({ tableName: "user_auth_method" })
@Unique({ properties: ["provider", "providerId"] })
@Index({ properties: ["user"] })
export class UserAuthMethod extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => User, { deleteRule: "cascade" })
	user!: Ref<User>;

	@Property({ type: "string" })
	provider!: AuthProvider;

	@Property({ type: "string" })
	providerId!: string;

	// Argon2id hash for 'email' provider; null for 'google'. Also null for
	// 'email' rows whose verification email has not yet been clicked (the row
	// exists in a `pending_signups` shape, not active).
	@Property({ type: "string", hidden: true, nullable: true })
	passwordHash?: string;

	@Property({ type: "timestamp", nullable: true })
	lastUsedAt?: Date;

	// Per-account brute-force defense (the per-IP throttle alone is bypassable
	// with enough IPs). Consecutive failed password attempts; reset on success.
	@Property({ type: "integer", default: 0 })
	failedLoginAttempts: number & Opt = 0;

	// While set and in the future, password logins are rejected with the
	// generic invalid-credentials error (no oracle for "this account exists
	// and is locked").
	@Property({ type: "timestamp", nullable: true })
	lockedUntil?: Date | null;
}
