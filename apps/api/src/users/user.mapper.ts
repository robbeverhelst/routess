import { createHash } from "node:crypto";
import { normalizeUserPreferences } from "@routess/core";
import type { User } from "../entities/user.entity";
import { UserProfileDto, UserResponseDto } from "./dto/user-response.dto";

type SerializableUser = Pick<User, "id" | "email" | "name" | "avatar" | "isEmailVerified" | "role" | "preferences">;

function hashUserId(salt: string, userId: number): string {
	return createHash("sha256").update(`${salt}:${userId}`).digest("hex");
}

export function toUserResponseDto(user: SerializableUser, analyticsSalt: string): UserResponseDto {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatar: user.avatar,
		isEmailVerified: user.isEmailVerified,
		role: user.role,
		preferences: user.preferences ? normalizeUserPreferences(user.preferences) : null,
		idHash: hashUserId(analyticsSalt, user.id),
	};
}

export function toUserProfileDto(
	user: SerializableUser,
	statistics: {
		totalRoutes: number;
		totalDistance: number;
	},
	analyticsSalt: string,
): UserProfileDto {
	return {
		...toUserResponseDto(user, analyticsSalt),
		statistics,
	};
}
