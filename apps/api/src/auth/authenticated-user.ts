export interface AuthenticatedUser {
	id: number;
	email: string;
	name: string;
	avatar?: string;
	isEmailVerified: boolean;
	jti: string;
}
