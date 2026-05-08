import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../../entities/user.entity";
import type { AuthenticatedUser } from "../authenticated-user";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (!required || required.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
		const user = request.user;
		if (!user || !required.includes(user.role)) {
			throw new ForbiddenException("Insufficient role");
		}
		return true;
	}
}
