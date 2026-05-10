# Resend for transactional email; console fallback in dev

Routess uses [Resend](https://resend.com) as its transactional email provider, accessed through `EmailService` (`apps/api/src/email/email.service.ts`). Required only for the email+password auth flows (signup verification, password reset) introduced by issue #134; Google-OAuth users never trigger an outbound email. When `RESEND_API_KEY` is unset, the service logs the email to stdout instead of sending — this is the dev/test default and means contributors don't need an API key to run the auth flows locally.

## Context

The email+password signup and password-reset flows in #134 require outbound transactional email. Picking a provider was the single non-trivial integration choice; everything else (argon2id, HIBP via k-anonymity, JWT sessions) was already aligned with existing infra.

## Considered options

- **SMTP via nodemailer + a self-hosted relay.** Rejected: another piece of infra to operate, deliverability headaches, no analytics. The whole appeal of a SaaS sender is that someone else runs the SMTP layer.
- **AWS SES.** Rejected: tight coupling to AWS that we don't otherwise have, and a sandbox-mode learning curve that bites every new environment.
- **Postmark / SendGrid / Mailgun.** All viable. Resend wins purely on developer ergonomics for the v1 feature set: a single `apiKey` env var, a one-line client, sensible defaults, and React Email templates available later if/when our HTML grows past inline strings.

## Consequences

- One env var (`RESEND_API_KEY`) and one config field (`EMAIL_FROM`) gate real sending. Set both in production; leave both unset in dev/test.
- Templates live as inline strings in `EmailService`. Acceptable for two short messages; if we add a third or want non-trivial layout, lift to React Email or MJML.
- Failure mode: when Resend errors, `EmailService.send` throws and the calling endpoint surfaces a 500. Signup and password-reset flows are user-initiated and retry-friendly, so this is acceptable. Failure to send a verification email is logged as an error, not silently swallowed.
- HIBP fail-open (network error → allow the password through) lives in `PasswordService`, not the email layer; documented inline.
