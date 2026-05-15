import type { ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// JWT auth that doesn't reject when the token is missing or invalid. Use on
// endpoints whose visibility is data-driven (e.g. public/unlisted Routes that
// anyone with the URL can fetch, but where the owner sees the same endpoint
// regardless of visibility).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
	override canActivate(context: ExecutionContext) {
		return super.canActivate(context);
	}

	override handleRequest<TUser>(_err: unknown, user: TUser | false): TUser | null {
		return user || null;
	}
}
