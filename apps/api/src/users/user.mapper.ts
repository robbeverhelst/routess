import type { User } from "../entities/user.entity";
import { UserProfileDto, UserResponseDto } from "./dto/user-response.dto";

type SerializableUser = Pick<User, "id" | "email" | "name" | "avatar" | "isEmailVerified">;

export function toUserResponseDto(user: SerializableUser): UserResponseDto {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatar: user.avatar,
		isEmailVerified: user.isEmailVerified,
	};
}

export function toUserProfileDto(
	user: SerializableUser,
	statistics: {
		totalRoutes: number;
		totalDistance: number;
	},
): UserProfileDto {
	return {
		...toUserResponseDto(user),
		statistics,
	};
}
