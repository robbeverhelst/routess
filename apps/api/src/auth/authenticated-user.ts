import type { UserRole } from "../entities/user.entity";

export interface AuthenticatedUser {
	id: number;
	email: string;
	name: string;
	avatar?: string;
	isEmailVerified: boolean;
	role: UserRole;
	jti: string;
}
