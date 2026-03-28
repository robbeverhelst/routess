import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../authenticated-user";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
	const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
	return request.user;
});
