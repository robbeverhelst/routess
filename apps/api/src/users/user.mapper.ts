import { createHash } from "node:crypto";
import { normalizeUserPreferences } from "@routess/core";
import type { User } from "../entities/user.entity";
import { PublicUserDto, UserProfileDto, UserResponseDto } from "./dto/user-response.dto";

type SerializableUser = Pick<
	User,
	| "id"
	| "email"
	| "name"
	| "avatar"
	| "isEmailVerified"
	| "role"
	| "preferences"
	| "deletionStatus"
	| "deletionRequestedAt"
>;

function hashUserId(salt: string, userId: number): string {
	return createHash("sha256").update(`${salt}:${userId}`).digest("hex");
}

// Owner shape embedded in route/collection responses, which other users (and
// anonymous visitors on public/unlisted pages) can see. Never add PII here.
export function toPublicUserDto(user: Pick<User, "id" | "name" | "avatar">, analyticsSalt: string): PublicUserDto {
	return {
		id: user.id,
		name: user.name,
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
