import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// OptionalJwtAuthGuard's unified sibling: resolves a cookie/Bearer JWT or a
// PAT when one is presented, and continues anonymously otherwise. Use on
// endpoints whose visibility is data-driven (public/unlisted refs anyone can
// fetch, private only for the owner) that non-browser clients also need.
// There is no ScopeGuard downstream: any valid PAT implies at least `read`,
// which is all these read-only endpoints require.
@Injectable()
export class OptionalUnifiedAuthGuard extends AuthGuard(["jwt", "pat-bearer"]) {
	override handleRequest<TUser>(_err: unknown, user: TUser | false): TUser | null {
		return user || null;
	}
}
