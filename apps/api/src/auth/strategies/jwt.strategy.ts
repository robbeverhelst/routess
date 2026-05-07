import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AppConfig } from "../../config/app-config";
import { APP_CONFIG } from "../../config/config.module";
import type { AuthenticatedUser } from "../authenticated-user";
import { SessionService } from "../session.service";

export interface JwtPayload {
	sub: number;
	email: string;
	jti?: string;
	iat?: number;
	exp?: number;
}

function tokenFromCookie(cookieName: string) {
	return (request: Request): string | null => {
		const cookieHeader = request.headers.cookie;
		if (!cookieHeader) {
			return null;
		}

		const cookies = cookieHeader.split(";").map((part) => part.trim());
		const prefix = `${cookieName}=`;
		const match = cookies.find((cookie) => cookie.startsWith(prefix));
		return match ? decodeURIComponent(match.slice(prefix.length)) : null;
	};
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		@Inject(APP_CONFIG) config: AppConfig,
		private sessionService: SessionService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				ExtractJwt.fromAuthHeaderAsBearerToken(),
				tokenFromCookie(config.auth.cookieName),
			]),
			ignoreExpiration: false,
			secretOrKey: config.auth.jwtSecret,
		});
	}

	async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
		if (!payload.jti) {
			throw new UnauthorizedException("Session is invalid");
		}

		// Single populated lookup: validates the session and resolves the
		// owning user in one query (was two: validateSession + validateUserById).
		const user = await this.sessionService.resolveAuthenticatedUser(payload.jti);
		if (!user) {
			throw new UnauthorizedException("Session expired or user not found");
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
