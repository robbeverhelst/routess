import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AppConfig } from "../../config/app-config";
import { APP_CONFIG } from "../../config/config.module";
import { AuthService } from "../auth.service";
import type { AuthenticatedUser } from "../authenticated-user";
import { SessionService } from "../session.service";

export interface JwtPayload {
	sub: number;
	email: string;
	jti?: string;
	iat?: number;
	exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		@Inject(APP_CONFIG) config: AppConfig,
		private authService: AuthService,
		private sessionService: SessionService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: config.auth.jwtSecret,
		});
	}

	async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
		if (!payload.jti) {
			throw new UnauthorizedException("Session is invalid");
		}

		const session = await this.sessionService.validateSession(payload.jti);
		if (!session) {
			throw new UnauthorizedException("Session expired or revoked");
		}

		const user = await this.authService.validateUserById(payload.sub);
		if (!user) {
			throw new UnauthorizedException("User not found");
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			isEmailVerified: user.isEmailVerified,
			jti: payload.jti,
		};
	}
}
