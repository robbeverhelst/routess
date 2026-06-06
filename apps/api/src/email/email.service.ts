import { Inject, Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";

interface SendArgs {
	to: string;
	subject: string;
	text: string;
	html: string;
}

// Layout follows the now-standard transactional pattern (Linear/Vercel/Resend
// itself/Stripe): single 600px white card on a neutral background, system
// fonts, one prominent dark CTA, a plain-text URL fallback, and a small grey
// footer with the expiry + a "you can ignore this" note. Inline styles only
// because Gmail strips <style> in some contexts, and table-based outer layout
// because Outlook still ignores most flexbox/grid.
const SHELL_BG = "#f4f4f5";
const CARD_BG = "#ffffff";
const TEXT_PRIMARY = "#0a0a0a";
const TEXT_BODY = "#404040";
const TEXT_MUTED = "#737373";
const BORDER = "#e5e7eb";
const BUTTON_BG = "#0a0a0a";
const BUTTON_FG = "#ffffff";
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

interface TemplateArgs {
	preheader: string;
	heading: string;
	intro: string;
	buttonLabel: string;
	url: string;
	fallbackLabel: string;
	footerNote: string;
}

function renderHtml(args: TemplateArgs): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${args.heading}</title>
</head>
<body style="margin:0;padding:0;background:${SHELL_BG};font-family:${FONT_STACK};color:${TEXT_BODY};-webkit-font-smoothing:antialiased;">
<!-- Preheader: shown in inbox preview, hidden from the body. -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;visibility:hidden;">
${escapeHtml(args.preheader)}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SHELL_BG};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
<tr><td style="padding:32px 32px 8px;">
<div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;color:${TEXT_PRIMARY};">routess</div>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:${TEXT_PRIMARY};">
${escapeHtml(args.heading)}
</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:${TEXT_BODY};">
${escapeHtml(args.intro)}
</p>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr><td style="border-radius:8px;background:${BUTTON_BG};">
<a href="${escapeAttr(args.url)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:${BUTTON_FG};text-decoration:none;border-radius:8px;line-height:1;">
${escapeHtml(args.buttonLabel)}
</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<p style="margin:0 0 6px;font-size:12.5px;line-height:1.5;color:${TEXT_MUTED};">
${escapeHtml(args.fallbackLabel)}
</p>
<p style="margin:0;font-size:12.5px;line-height:1.5;color:${TEXT_MUTED};word-break:break-all;">
<a href="${escapeAttr(args.url)}" style="color:${TEXT_MUTED};text-decoration:underline;">${escapeHtml(args.url)}</a>
</p>
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid ${BORDER};">
<p style="margin:0;font-size:12px;line-height:1.5;color:${TEXT_MUTED};">
${escapeHtml(args.footerNote)}
</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11.5px;color:${TEXT_MUTED};">routess · route planning for cyclists, runners, hikers</p>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
	return escapeHtml(value);
}

@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);
	private readonly resend: Resend | null;

	constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
		this.resend = config.email.provider === "resend" ? new Resend(config.email.resendApiKey) : null;
	}

	async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
		const subject = "Verify your routess account";
		const heading = "Verify your email";
		const intro = "Confirm this is you to finish creating your routess account.";
		const buttonLabel = "Verify email";
		const fallbackLabel = "If the button above doesn't work, paste this link into your browser:";
		const footerNote =
			"This link expires in 24 hours. If you didn't sign up for routess, you can ignore this email — no account will be created.";

		const text = `Verify your routess email

${intro}

${verifyUrl}

${footerNote}`;
		const html = renderHtml({
			preheader: intro,
			heading,
			intro,
			buttonLabel,
			url: verifyUrl,
			fallbackLabel,
			footerNote,
		});
		await this.send({ to, subject, text, html });
	}

	// Sent instead of a 409 when someone signs up with an email that already
	// has an account: the HTTP response stays identical to a fresh signup so
	// the endpoint can't be used to probe which emails are registered.
	async sendAccountExistsEmail(to: string, loginUrl: string): Promise<void> {
		const subject = "You already have a routess account";
		const heading = "You already have an account";
		const intro =
			"Someone (hopefully you) tried to sign up for routess with this email, but an account already exists. Sign in instead; if you forgot your password, you can reset it from the sign-in page.";
		const buttonLabel = "Sign in";
		const fallbackLabel = "If the button above doesn't work, paste this link into your browser:";
		const footerNote = "If this wasn't you, you can ignore this email. No new account was created.";

		const text = `You already have a routess account

${intro}

${loginUrl}

${footerNote}`;
		const html = renderHtml({
			preheader: intro,
			heading,
			intro,
			buttonLabel,
			url: loginUrl,
			fallbackLabel,
			footerNote,
		});
		await this.send({ to, subject, text, html });
	}

	// Sent when the per-account login lockout trips. The HTTP responses stay
	// generic (no lock-state oracle for attackers); this tells the legitimate
	// owner what happened and how to regain access immediately.
	async sendAccountLockedEmail(to: string, loginUrl: string): Promise<void> {
		const subject = "Failed sign-in attempts on your routess account";
		const heading = "We noticed failed sign-in attempts";
		const intro =
			"Someone made several failed attempts to sign in to your routess account, so sign-in with a password is paused for 15 minutes. If this was you, just wait and try again. If it wasn't, resetting your password from the sign-in page restores access immediately and signs out all sessions.";
		const buttonLabel = "Go to sign-in";
		const fallbackLabel = "If the button above doesn't work, paste this link into your browser:";
		const footerNote = "No one got in: the attempts failed. Resetting your password also clears the pause.";

		const text = `Failed sign-in attempts on your routess account

${intro}

${loginUrl}

${footerNote}`;
		const html = renderHtml({
			preheader: intro,
			heading,
			intro,
			buttonLabel,
			url: loginUrl,
			fallbackLabel,
			footerNote,
		});
		await this.send({ to, subject, text, html });
	}

	async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
		const subject = "Reset your routess password";
		const heading = "Reset your password";
		const intro = "Click the button below to choose a new password for your routess account.";
		const buttonLabel = "Reset password";
		const fallbackLabel = "If the button above doesn't work, paste this link into your browser:";
		const footerNote =
			"This link expires in 30 minutes. If you didn't request a reset, you can ignore this email — your password won't change.";

		const text = `Reset your routess password

${intro}

${resetUrl}

${footerNote}`;
		const html = renderHtml({
			preheader: intro,
			heading,
			intro,
			buttonLabel,
			url: resetUrl,
			fallbackLabel,
			footerNote,
		});
		await this.send({ to, subject, text, html });
	}

	async sendRouteShareEmail(
		to: string,
		args: { senderName: string; routeName: string; message?: string; url: string },
	): Promise<void> {
		const subject = `${args.senderName} shared a route with you on routess`;
		const heading = `${args.senderName} shared a route with you`;
		const intro = args.message
			? `"${args.routeName}" landed in your routess inbox with a note: "${args.message}"`
			: `"${args.routeName}" landed in your routess inbox.`;
		const buttonLabel = "View route";
		const fallbackLabel = "If the button above doesn't work, paste this link into your browser:";
		const footerNote =
			"You receive this because someone shared a route with your routess account. You can turn these emails off in Settings.";

		const text = `${heading}

${intro}

${args.url}

${footerNote}`;
		const html = renderHtml({
			preheader: intro,
			heading,
			intro,
			buttonLabel,
			url: args.url,
			fallbackLabel,
			footerNote,
		});
		await this.send({ to, subject, text, html });
	}

	private async send(args: SendArgs): Promise<void> {
		if (!this.resend) {
			this.logger.log(`[email:console] to=${args.to} subject="${args.subject}"\n${args.text}`);
			return;
		}
		try {
			const result = await this.resend.emails.send({
				from: this.config.email.from,
				to: args.to,
				subject: args.subject,
				text: args.text,
				html: args.html,
			});
			if (result.error) {
				this.logger.error(`Resend error: ${result.error.message}`);
				throw new Error(`Failed to send email: ${result.error.message}`);
			}
		} catch (error) {
			this.logger.error("Failed to send email", error);
			throw error;
		}
	}
}
