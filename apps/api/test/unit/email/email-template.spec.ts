import { EmailService } from "src/email/email.service";

// We can't easily reach the private renderHtml directly, but we don't have to:
// EmailService.send() short-circuits to the console logger when the provider
// is "console", so we wrap the logger to capture the HTML emitted on each
// send. This catches accidental template regressions (broken interpolation,
// missing escapes, layout drift) without requiring Resend.

type CapturedMessage = { subject: string; text: string; html: string; to: string };

function makeService(): { service: EmailService; sent: CapturedMessage[] } {
	const sent: CapturedMessage[] = [];
	const service = new EmailService({
		// Only the email-relevant slice is read by the service.
		email: { provider: "resend", resendApiKey: "test", from: "Routess <test@routess.com>" },
	} as unknown as ConstructorParameters<typeof EmailService>[0]);
	// Replace the private resend client with a capturing stub.
	const stubClient = {
		emails: {
			send: async (args: { to: string; subject: string; text: string; html: string }) => {
				sent.push(args);
				return { error: null, data: { id: "stub" } };
			},
		},
	};
	(service as unknown as { resend: typeof stubClient }).resend = stubClient;
	return { service, sent };
}

describe("EmailService templates", () => {
	it("renders the verification email with subject, button label, and verify URL inline", async () => {
		const { service, sent } = makeService();
		await service.sendVerificationEmail("alice@example.com", "https://routess.com/auth/verify-email?token=abc123");
		expect(sent).toHaveLength(1);
		const msg = sent[0];
		expect(msg.subject).toBe("Verify your routess account");
		expect(msg.to).toBe("alice@example.com");
		expect(msg.html).toContain("Verify your email");
		expect(msg.html).toContain("Verify email");
		expect(msg.html).toContain("https://routess.com/auth/verify-email?token=abc123");
		expect(msg.html).toContain("expires in 24 hours");
		// Plain text version includes the URL too.
		expect(msg.text).toContain("https://routess.com/auth/verify-email?token=abc123");
	});

	it("renders the password reset email with the reset URL and 30-min expiry note", async () => {
		const { service, sent } = makeService();
		await service.sendPasswordResetEmail("alice@example.com", "https://routess.com/auth/reset-password?token=xyz");
		expect(sent).toHaveLength(1);
		const msg = sent[0];
		expect(msg.subject).toBe("Reset your routess password");
		expect(msg.html).toContain("Reset your password");
		expect(msg.html).toContain("Reset password");
		expect(msg.html).toContain("https://routess.com/auth/reset-password?token=xyz");
		expect(msg.html).toContain("expires in 30 minutes");
		expect(msg.text).toContain("https://routess.com/auth/reset-password?token=xyz");
	});

	it("escapes HTML-special characters in user-supplied URLs", async () => {
		const { service, sent } = makeService();
		// A pathological URL with characters that, if not escaped, could break
		// the surrounding HTML or inject markup.
		await service.sendVerificationEmail(
			"alice@example.com",
			"https://routess.com/auth/verify-email?token=abc<\"'&>def",
		);
		const html = sent[0].html;
		// Raw characters must NOT appear unescaped inside the document.
		expect(html.includes("token=abc<\"'&>def")).toBe(false);
		// The escaped form is present.
		expect(html).toContain("token=abc&lt;&quot;&#39;&amp;&gt;def");
	});
});
