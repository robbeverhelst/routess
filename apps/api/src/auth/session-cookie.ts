import type { Response } from "express";
import type { AppConfig } from "../config/app-config";

// Single source of truth for the session cookie attributes. Both the auth
// controller (login/logout) and the rolling-refresh interceptor write the
// cookie through here so the options never drift, which would otherwise create
// duplicate cookies the browser can't reconcile.
export function setSessionCookie(res: Response, config: AppConfig, accessToken: string): void {
	res.cookie(config.auth.cookieName, accessToken, {
		httpOnly: true,
		secure: config.app.isProduction,
		sameSite: config.app.isProduction ? "none" : "lax",
		maxAge: config.auth.sessionTtlMs,
		path: "/",
	});
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
	res.clearCookie(config.auth.cookieName, {
		httpOnly: true,
		secure: config.app.isProduction,
		sameSite: config.app.isProduction ? "none" : "lax",
		path: "/",
	});
}
