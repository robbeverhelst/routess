import { Controller, Get, HttpCode, Inject, Post, Query, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { verifyUnsubscribeToken } from "./unsubscribe-token";
import { WeeklyDigestService } from "./weekly-digest.service";

// Unsubscribe from the weekly digest without signing in. GET only shows a
// confirm button, because mail scanners prefetch links; the POST (from that
// button, or a mail client's RFC 8058 one-click) withdraws consent.
@ApiExcludeController()
@Controller("email/unsubscribe")
export class UnsubscribeController {
	constructor(
		private readonly digest: WeeklyDigestService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	@ThrottleModerate()
	@Get()
	confirm(@Query("token") token: string | undefined, @Res() res: Response): void {
		const valid = token && verifyUnsubscribeToken(this.config.auth.jwtSecret, token) !== null;
		if (!valid) {
			res.status(400).type("html").send(page("This unsubscribe link is not valid.", ""));
			return;
		}
		const action = `?token=${encodeURIComponent(token)}`;
		res
			.type("html")
			.send(
				page(
					"Stop the weekly routes email?",
					`<form method="post" action="${escapeHtml(action)}"><button type="submit">Unsubscribe</button></form>`,
				),
			);
	}

	@ThrottleModerate()
	@Post()
	@HttpCode(200)
	async unsubscribe(@Query("token") token: string | undefined, @Res() res: Response): Promise<void> {
		const userId = token ? verifyUnsubscribeToken(this.config.auth.jwtSecret, token) : null;
		if (userId === null) {
			res.status(400).type("html").send(page("This unsubscribe link is not valid.", ""));
			return;
		}
		await this.digest.unsubscribe(userId);
		res.type("html").send(page("You are unsubscribed.", "<p>You will not get the weekly routes email anymore.</p>"));
	}
}

function page(heading: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>routess</title>
<style>
body{margin:0;padding:48px 16px;background:#f4f4f5;color:#404040;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}
main{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px}
h1{margin:0 0 12px;font-size:20px;color:#0a0a0a}
button{padding:12px 22px;font-size:14px;font-weight:600;color:#fff;background:#0a0a0a;border:0;border-radius:8px;cursor:pointer}
</style>
</head>
<body><main><p><strong>routess</strong></p><h1>${escapeHtml(heading)}</h1>${body}</main></body>
</html>`;
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
