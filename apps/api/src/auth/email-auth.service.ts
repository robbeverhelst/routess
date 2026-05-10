import { randomBytes } from "node:crypto";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { EmailService } from "../email/email.service";
import { User } from "../entities/user.entity";
import { UserAuthMethod } from "../entities/user-auth-method.entity";
import { VerificationToken } from "../entities/verification-token.entity";
import {
	AUTH_LOGIN_ATTEMPTED,
	type AuthLoginAttemptedEvent,
	USER_REGISTERED,
	type UserRegisteredEvent,
} from "../telemetry/domain-events";
import { toUserResponseDto } from "../users/user.mapper";
import type { AuthResponseDto } from "./dto";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

interface SessionContext {
	userAgent?: string | string[];
	ipAddress?: string;
}

@Injectable()
export class EmailAuthService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		@InjectRepository(UserAuthMethod)
		private readonly authMethodRepository: EntityRepository<UserAuthMethod>,
		@InjectRepository(VerificationToken)
		private readonly tokenRepository: EntityRepository<VerificationToken>,
		private readonly em: EntityManager,
		private readonly passwordService: PasswordService,
		private readonly emailService: EmailService,
		private readonly sessionService: SessionService,
		private readonly events: EventEmitter2,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	// Step 1 of email+password signup. Validates the password, hashes it, stores
	// it on a pending_signup token, and emails a verification link. The User
	// row is NOT created here — it's created on token consumption. Email is
	// rejected outright if a User already exists with that address (the user
	// should sign in via their existing method and add a password from settings).
	async signupRequest(email: string, name: string, password: string): Promise<void> {
		const normalisedEmail = email.toLowerCase().trim();
		await this.passwordService.validateOrThrow(password);

		const existingUser = await this.userRepository.findOne(
			{ email: normalisedEmail },
			{ filters: { softDelete: false } },
		);
		if (existingUser) {
			throw new ConflictException(
				"An account with this email already exists. Sign in instead, then add a password from settings.",
			);
		}

		// Invalidate any prior pending_signup tokens for this email so only the
		// most recent verification link works.
		await this.em
			.getConnection()
			.execute(
				`update "verification_token" set "used_at" = now() where "email" = ? and "purpose" = 'pending_signup' and "used_at" is null`,
				[normalisedEmail],
			);

		const token = randomBytes(32).toString("hex");
		const passwordHash = await this.passwordService.hash(password);
		const tokenRow = this.tokenRepository.create({
			token,
			purpose: "pending_signup",
			email: normalisedEmail,
			passwordHash,
			expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
		});
		// Cache the chosen display name on the token row by abusing the email
		// field is wrong — store in a side channel. For v1 we re-derive name
		// from the email at consumption time and let the user edit later.
		await this.em.persistAndFlush(tokenRow);

		// Display name: keep it simple. We don't store name on the token; it
		// defaults to the email local-part on consume. User can change it in
		// settings. Storing name on token is over-modelling for v1.
		void name;

		const verifyUrl = `${this.config.app.frontendUrl}/auth/verify-email?token=${token}`;
		await this.emailService.sendVerificationEmail(normalisedEmail, verifyUrl);
	}

	// Step 2 of email+password signup. Consumes a pending_signup token, creates
	// the User and the UserAuthMethod with the password hash, and starts a
	// session.
	async verifyEmail(token: string, sessionContext?: SessionContext): Promise<AuthResponseDto> {
		const tokenRow = await this.tokenRepository.findOne({ token, purpose: "pending_signup" });
		if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt.getTime() < Date.now() || !tokenRow.passwordHash) {
			throw new BadRequestException("This verification link is invalid or has expired.");
		}

		// Race: another signup attempt with the same email might have completed
		// between the token issue and now. Reject in that case.
		const existing = await this.userRepository.findOne({ email: tokenRow.email }, { filters: { softDelete: false } });
		if (existing) {
			tokenRow.usedAt = new Date();
			await this.em.persistAndFlush(tokenRow);
			throw new ConflictException("An account with this email already exists.");
		}

		const desiredRole = this.resolveDesiredRole(tokenRow.email);
		const localPart = tokenRow.email.split("@")[0] ?? tokenRow.email;
		const user = this.userRepository.create({
			email: tokenRow.email,
			name: localPart,
			isEmailVerified: true,
			role: desiredRole ?? "user",
			deletionStatus: "active",
		});
		await this.em.persistAndFlush(user);

		const method = this.authMethodRepository.create({
			user: user.id,
			provider: "email",
			providerId: tokenRow.email,
			passwordHash: tokenRow.passwordHash,
			lastUsedAt: new Date(),
		});
		await this.em.persistAndFlush(method);

		tokenRow.usedAt = new Date();
		await this.em.persistAndFlush(tokenRow);

		this.events.emit(USER_REGISTERED, { source: "email" } satisfies UserRegisteredEvent);

		const accessToken = await this.sessionService.createSession(user.id, {
			userAgent: this.normaliseUserAgent(sessionContext?.userAgent),
			ipAddress: sessionContext?.ipAddress,
		});

		return {
			accessToken,
			user: toUserResponseDto(user, this.config.analytics.salt),
		};
	}

	async login(email: string, password: string, sessionContext?: SessionContext): Promise<AuthResponseDto> {
		const normalisedEmail = email.toLowerCase().trim();
		const method = await this.authMethodRepository.findOne(
			{ provider: "email", providerId: normalisedEmail },
			{ populate: ["user"], filters: { softDelete: false } },
		);
		if (!method?.passwordHash) {
			this.emitLoginAttempt("invalid_token");
			// Do hash comparison work to avoid leaking timing differences between
			// "no such email" and "wrong password".
			await this.passwordService.verify("$argon2id$v=19$m=19456,t=2,p=1$AAAA$AAAA", password);
			throw new UnauthorizedException("Email or password is incorrect.");
		}
		const ok = await this.passwordService.verify(method.passwordHash, password);
		if (!ok) {
			this.emitLoginAttempt("invalid_token");
			throw new UnauthorizedException("Email or password is incorrect.");
		}

		const user = method.user as unknown as User;
		method.lastUsedAt = new Date();
		await this.em.persistAndFlush(method);

		const accessToken = await this.sessionService.createSession(user.id, {
			userAgent: this.normaliseUserAgent(sessionContext?.userAgent),
			ipAddress: sessionContext?.ipAddress,
		});
		this.emitLoginAttempt("success");
		return {
			accessToken,
			user: toUserResponseDto(user, this.config.analytics.salt),
		};
	}

	// Add a password to a User who is signed in via another method (or change an
	// existing password). HIBP/length validation always applies. If the user
	// already has a password and supplies the wrong current one, reject.
	async setPassword(userId: number, newPassword: string, currentPassword?: string): Promise<void> {
		const user = await this.userRepository.findOneOrFail({ id: userId });
		await this.passwordService.validateOrThrow(newPassword);

		const existing = await this.authMethodRepository.findOne({
			provider: "email",
			providerId: user.email,
		});

		if (existing?.passwordHash) {
			if (!currentPassword) {
				throw new BadRequestException("Current password is required to change your password.");
			}
			const ok = await this.passwordService.verify(existing.passwordHash, currentPassword);
			if (!ok) throw new UnauthorizedException("Current password is incorrect.");
		}

		const newHash = await this.passwordService.hash(newPassword);
		if (existing) {
			existing.passwordHash = newHash;
			existing.lastUsedAt = new Date();
			await this.em.persistAndFlush(existing);
		} else {
			const method = this.authMethodRepository.create({
				user: user.id,
				provider: "email",
				providerId: user.email,
				passwordHash: newHash,
				lastUsedAt: new Date(),
			});
			await this.em.persistAndFlush(method);
		}
	}

	// Always returns 200 to the caller (no email enumeration). Sends a reset
	// email only if a user with this email + 'email' auth method exists. Users
	// with only Google auth can't reset a password they never had.
	async requestPasswordReset(email: string): Promise<void> {
		const normalisedEmail = email.toLowerCase().trim();
		const user = await this.userRepository.findOne({ email: normalisedEmail });
		if (!user) return;
		const method = await this.authMethodRepository.findOne({
			provider: "email",
			providerId: normalisedEmail,
		});
		if (!method?.passwordHash) return;

		await this.em
			.getConnection()
			.execute(
				`update "verification_token" set "used_at" = now() where "email" = ? and "purpose" = 'password_reset' and "used_at" is null`,
				[normalisedEmail],
			);

		const token = randomBytes(32).toString("hex");
		const tokenRow = this.tokenRepository.create({
			token,
			purpose: "password_reset",
			email: normalisedEmail,
			user: user.id,
			expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
		});
		await this.em.persistAndFlush(tokenRow);

		const resetUrl = `${this.config.app.frontendUrl}/auth/reset-password?token=${token}`;
		await this.emailService.sendPasswordResetEmail(normalisedEmail, resetUrl);
	}

	// Consumes a password_reset token, replaces the password hash, and invalidates
	// ALL sessions for the user (including any session that initiated the reset)
	// because reset implies the old credentials may be compromised.
	async resetPassword(token: string, newPassword: string): Promise<void> {
		const tokenRow = await this.tokenRepository.findOne({ token, purpose: "password_reset" }, { populate: ["user"] });
		if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt.getTime() < Date.now()) {
			throw new BadRequestException("This reset link is invalid or has expired.");
		}
		await this.passwordService.validateOrThrow(newPassword);

		const user = tokenRow.user as unknown as User;
		const method = await this.authMethodRepository.findOne({ provider: "email", providerId: user.email });
		if (!method) {
			throw new BadRequestException("Cannot reset password for an account without a password set up.");
		}

		method.passwordHash = await this.passwordService.hash(newPassword);
		method.lastUsedAt = new Date();
		tokenRow.usedAt = new Date();
		await this.em.persistAndFlush([method, tokenRow]);
		await this.sessionService.invalidateUserSessions(user.id, "invalidated");
	}

	private emitLoginAttempt(result: AuthLoginAttemptedEvent["result"]) {
		this.events.emit(AUTH_LOGIN_ATTEMPTED, {
			provider: "email",
			result,
		} satisfies AuthLoginAttemptedEvent);
	}

	private resolveDesiredRole(email: string): "user" | "admin" | null {
		const allowlist = this.config.auth.adminEmails;
		if (allowlist.length === 0) return null;
		return allowlist.includes(email.toLowerCase()) ? "admin" : "user";
	}

	private normaliseUserAgent(value: string | string[] | undefined): string | undefined {
		if (!value) return undefined;
		return typeof value === "string" ? value : value.join(", ");
	}
}
