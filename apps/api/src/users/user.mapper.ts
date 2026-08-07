import { createHash } from "node:crypto";
import { normalizeUserPreferences } from "@routess/core";
import type { User } from "../entities/user.entity";
import { PublicUserDto, UserProfileDto, UserResponseDto } from "./dto/user-response.dto";

type SerializableUser = Pick<
	User,
	| "id"
	| "email"
	| "name"
	| "handle"
	| "avatar"
	| "isEmailVerified"
	| "role"
	| "preferences"
	| "deletionStatus"
	| "deletionRequestedAt"
>;

// Also used by the analytics erasure path, which must reproduce exactly the
// hash the browser shipped as `user_id_hash`. Keep it the only implementation.
export function hashUserId(salt: string, userId: number): string {
	return createHash("sha256").update(`${salt}:${userId}`).digest("hex");
}

// Owner shape embedded in route/collection responses, which other users (and
// anonymous visitors on public/unlisted pages) can see. Never add PII here.
// The Handle is deliberately public: it is the Profile's address (CONTEXT.md).
export function toPublicUserDto(
	user: Pick<User, "id" | "name" | "handle" | "avatar">,
	analyticsSalt: string,
): PublicUserDto {
	return {
		id: user.id,
		name: user.name,
		handle: user.handle,
		avatar: user.avatar,
		idHash: hashUserId(analyticsSalt, user.id),
	};
}

// `hasPassword` is computed by the caller (typically by querying
// UserAuthMethod for a row with provider='email' and a non-null password
// hash); flows that don't care can leave it as the default false and the
// frontend just won't render password-aware UI.
export function toUserResponseDto(user: SerializableUser, analyticsSalt: string, hasPassword = false): UserResponseDto {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		handle: user.handle,
		avatar: user.avatar,
		isEmailVerified: user.isEmailVerified,
		role: user.role,
		preferences: user.preferences ? normalizeUserPreferences(user.preferences) : null,
		idHash: hashUserId(analyticsSalt, user.id),
		deletionStatus: user.deletionStatus,
		deletionRequestedAt: user.deletionRequestedAt ? user.deletionRequestedAt.toISOString() : null,
		hasPassword,
	};
}

export function toUserProfileDto(
	user: SerializableUser,
	statistics: {
		totalRoutes: number;
		totalDistance: number;
	},
	analyticsSalt: string,
	hasPassword = false,
): UserProfileDto {
	return {
		...toUserResponseDto(user, analyticsSalt, hasPassword),
		statistics,
	};
}
