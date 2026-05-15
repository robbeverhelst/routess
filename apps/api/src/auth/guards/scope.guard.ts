import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PatScope } from "../../entities/personal-access-token.entity";
import type { AuthenticatedUser } from "../authenticated-user";
import { REQUIRED_SCOPE_KEY } from "../decorators/require-scope.decorator";

// Enforces ADR-0022's scope model on handlers that opt in via @RequireScope.
// Apply alongside UnifiedAuthGuard. Cookie sessions are always allowed
// through; PAT-authenticated requests must declare a sufficient scope or
// they are rejected with FORBIDDEN. Handlers without @RequireScope reject
// PATs unconditionally — opt-in is explicit so a new endpoint cannot
// accidentally accept PATs without a deliberate choice.
@Injectable()
export class ScopeGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
		if (!user) {
			// UnifiedAuthGuard runs before this and would have rejected an
			// unauthenticated request, but be defensive.
			throw new ForbiddenException("Authentication required");
		}

		if (user.authMethod === "cookie") {
			return true;
		}

		const requiredScope = this.reflector.getAllAndOverride<PatScope | undefined>(REQUIRED_SCOPE_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredScope) {
			throw new ForbiddenException("This endpoint is not accessible via personal access tokens");
		}

		// write subsumes read; any other combination must match exactly.
		const ok = requiredScope === "read" ? user.scope === "read" || user.scope === "write" : user.scope === "write";
		if (!ok) {
			throw new ForbiddenException(
				`This personal access token has scope "${user.scope}" but the endpoint requires "${requiredScope}"`,
			);
		}

		return true;
	}
}
