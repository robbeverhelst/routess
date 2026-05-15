import { wrap } from "@mikro-orm/core";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";
import type { User } from "../../entities/user.entity";
import type { AuthenticatedUser } from "../authenticated-user";
import { PAT_TOKEN_PREFIX, PersonalAccessTokensService } from "../personal-access-tokens.service";

type SerializableUser = Pick<User, "id" | "email" | "name" | "avatar" | "isEmailVerified" | "role">;

// Passport strategy for Personal Access Tokens presented as
//   Authorization: Bearer routess_pat_<random>
// Strategy name is "pat-bearer". The unified guard
// (UnifiedAuthGuard) chains this strategy after the JWT strategy so a
// cookie-authenticated browser session still works on the same endpoints.
@Injectable()
export class PatBearerStrategy extends PassportStrategy(Strategy, "pat-bearer") {
	constructor(private readonly tokensService: PersonalAccessTokensService) {
		super();
	}

	async validate(token: string): Promise<AuthenticatedUser> {
		// Fast-reject anything that does not look like a PAT before hitting
		// the database. Cookie-authenticated JWT bearer tokens land here too
		// when the JWT strategy is not first in the chain, so this is hot.
		if (!token.startsWith(PAT_TOKEN_PREFIX)) {
			throw new UnauthorizedException("Invalid token");
		}

		const record = await this.tokensService.verifyAndTouch(token);
		if (!record) {
			throw new UnauthorizedException("Invalid or revoked personal access token");
		}

		// `verifyAndTouch` populated `user`. Unwrapping a Ref is cheap;
		// we are reading fields already loaded into the identity map.
		const user = wrap(record.user).toJSON() as SerializableUser;

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			isEmailVerified: user.isEmailVerified,
			role: user.role,
			authMethod: "pat",
			jti: String(record.id),
			scope: record.scope,
		};
	}
}
