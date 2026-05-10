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

// Wraps the chosen email backend (Resend in prod, console logger in dev/test
// when no RESEND_API_KEY is present). Templates are inline strings; if/when
// they grow we'll lift them to MJML or react-email, but a few short messages
// don't justify a templating system.
@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);
	private readonly resend: Resend | null;

	constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
		this.resend = config.email.provider === "resend" ? new Resend(config.email.resendApiKey) : null;
	}

	async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
		const subject = "Verify your routess account";
		const text = `Welcome to routess.

Click the link below to verify your email address and activate your account:

${verifyUrl}

This link expires in 24 hours. If you didn't sign up, you can ignore this email.`;
		const html = `<p>Welcome to <strong>routess</strong>.</p>
<p>Click the link below to verify your email address and activate your account:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p style="color:#666;font-size:12px">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`;
		await this.send({ to, subject, text, html });
	}

	async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
		const subject = "Reset your routess password";
		const text = `Someone requested a password reset for your routess account.

If that was you, click the link below to choose a new password:

${resetUrl}

This link expires in 30 minutes. If you didn't request this, you can ignore this email — your password won't change.`;
		const html = `<p>Someone requested a password reset for your <strong>routess</strong> account.</p>
<p>If that was you, click the link below to choose a new password:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p style="color:#666;font-size:12px">This link expires in 30 minutes. If you didn't request this, you can ignore this email — your password won't change.</p>`;
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
