import { type CallHandler, type ExecutionContext, Inject, Injectable, type NestInterceptor } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { AppConfig } from "../../config/app-config";
import { APP_CONFIG } from "../../config/config.module";
import type { AuthenticatedUser } from "../authenticated-user";
import { setSessionCookie } from "../session-cookie";

// Rolling session (issue: "still logged in but cannot use the app"). Every
// request that authenticated via the session cookie gets a freshly signed
// cookie with a full TTL, so an actively-used session never hits the absolute
// JWT/session expiry. The DB session's expiresAt is slid in lockstep (throttled)
// by SessionService. After a true idle gap the cookie and the DB row both lapse
// and the user is logged out. Bearer-JWT and PAT requests carry no cookie and
// are left untouched.
@Injectable()
export class SessionRefreshInterceptor implements NestInterceptor {
	constructor(
		private readonly jwtService: JwtService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (context.getType() !== "http") return next.handle();

		const http = context.switchToHttp();
		const request = http.getRequest<Request & { user?: AuthenticatedUser }>();
		const response = http.getResponse<Response>();

		return next.handle().pipe(
			tap(() => {
				const user = request.user;
				if (user?.authMethod !== "cookie" || !user.jti) return;
				if (!this.requestCarriedSessionCookie(request)) return;
				// A handler that already wrote the cookie wins (login re-issue,
				// logout clear); never override it. And bail if the body already
				// streamed (file/export endpoints) to avoid "headers sent".
				if (response.headersSent || this.responseAlreadySetCookie(response)) return;

				const token = this.jwtService.sign({ sub: user.id, email: user.email, jti: user.jti });
				setSessionCookie(response, this.config, token);
			}),
		);
	}

	private requestCarriedSessionCookie(request: Request): boolean {
		const prefix = `${this.config.auth.cookieName}=`;
		return (request.headers.cookie ?? "").split(";").some((part) => part.trim().startsWith(prefix));
	}

	private responseAlreadySetCookie(response: Response): boolean {
		const existing = response.getHeader("Set-Cookie");
		const prefix = `${this.config.auth.cookieName}=`;
		if (Array.isArray(existing)) {
			return existing.some((cookie) => typeof cookie === "string" && cookie.startsWith(prefix));
		}
		return typeof existing === "string" && existing.startsWith(prefix);
	}
}
