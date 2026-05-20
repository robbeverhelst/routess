import type { PatScope } from "../entities/personal-access-token.entity";
import type { UserRole } from "../entities/user.entity";

// How the current request was authenticated.
//   - "cookie": a JWT session, either via the session cookie or a Bearer JWT
//     header. Comes from the JwtStrategy and represents an interactive
//     browser/web user.
//   - "pat": a Personal Access Token presented as Bearer routess_pat_…
//     by a non-browser client (CLI, AI agent, script). Scoped to read or
//     write per ADR-0022 and blocked from admin / account deletion.
export type AuthMethod = "cookie" | "pat";

export interface AuthenticatedUser {
	id: number;
	email: string;
	name: string;
	avatar?: string;
	isEmailVerified: boolean;
	role: UserRole;
	authMethod: AuthMethod;
	// JWT id for cookie sessions (used by SessionService.revoke); the database
	// id of the PersonalAccessToken row for PAT-authenticated requests (used
	// for self-revocation and per-token throttling).
	jti: string;
	// Only set when authMethod === "pat".
	scope?: PatScope;
}
