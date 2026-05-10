import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../authenticated-user";

// Use under JwtAuthGuard — the guard guarantees a user is present.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
	const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
	return request.user;
});

// Use under OptionalJwtAuthGuard — returns null when the request has no token
// or an invalid token.
export const OptionalCurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser | null => {
		const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser | null | undefined }>();
		return request.user ?? null;
	},
);
