import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { randomHandle, User, type UserRole } from "../entities/user.entity";
import { UserAuthMethod } from "../entities/user-auth-method.entity";
import {
	AUTH_LOGIN_ATTEMPTED,
	type AuthLoginAttemptedEvent,
	type AuthLoginResult,
	USER_REGISTERED,
	USER_UNDELETED,
	type UserRegisteredEvent,
	type UserUndeletedEvent,
} from "../telemetry/domain-events";
import { generateUniqueHandle, isHandleUniqueViolation } from "../users/handle.util";
import { toUserResponseDto } from "../users/user.mapper";
import type { AuthResponseDto, GoogleAuthDto } from "./dto";
import { GOOGLE_IDENTITY_VERIFIER, type GoogleIdentity, type GoogleIdentityVerifier } from "./google-identity-verifier";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User)
		private userRepository: EntityRepository<User>,
		@InjectRepository(UserAuthMethod)
		private authMethodRepository: EntityRepository<UserAuthMethod>,
		private entityManager: EntityManager,
		@Inject(GOOGLE_IDENTITY_VERIFIER)
		private readonly googleIdentityVerifier: GoogleIdentityVerifier,
		private readonly events: EventEmitter2,
		private sessionService: SessionService,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	async googleAuth(
		googleAuthDto: GoogleAuthDto,
		sessionContext?: {
			userAgent?: string | string[];
			ipAddress?: string;
		},
	): Promise<AuthResponseDto> {
		let identity: GoogleIdentity;
		try {
			identity = await this.googleIdentityVerifier.verify(googleAuthDto.code);
		} catch (error) {
			const result = this.classifyVerificationError(error);
			this.emitLoginAttempt(result);
			throw error;
		}

		const { googleId, name, picture } = identity;
		// Normalize to lowercase everywhere: User.email is unique, and the
		// email auth flow keys its lookups (and UserAuthMethod.providerId) on
		// the lowercased address. A mixed-case Google email would otherwise
		// create a parallel account / break later password setup.
		const email = identity.email.toLowerCase().trim();
		const desiredRole = this.resolveDesiredRole(email);

		// Look up by Google identity first (provider+providerId is the canonical
		// auth-method match), falling back to email so users who already have an
		// 'email' method get linked to the same User when they later sign in via
		// Google.
		const existingMethod = await this.authMethodRepository.findOne(
			{ provider: "google", providerId: googleId },
			{ populate: ["user"], filters: { softDelete: false } },
		);
		let user = existingMethod ? existingMethod.user : null;
		if (!user) {
			user = await this.userRepository.findOne({ email }, { filters: { softDelete: false } });
		}

		if (!user) {
			user = this.userRepository.create({
				email,
				name: name || email,
				handle: await generateUniqueHandle(this.entityManager, name || "", email),
				avatar: picture,
				isEmailVerified: true,
				role: desiredRole ?? "user",
				deletionStatus: "active",
			});
			try {
				await this.entityManager.persist(user).flush();
			} catch (error) {
				// Lost the handle race to a concurrent signup; retry once random.
				if (!isHandleUniqueViolation(error)) throw error;
				user.handle = randomHandle();
				await this.entityManager.persist(user).flush();
			}
			await this.upsertGoogleAuthMethod(user, googleId);
			this.events.emit(USER_REGISTERED, { source: "google" } satisfies UserRegisteredEvent);
		} else {
			let mutated = false;
			// ADR 0017: a user in 'pending_hard_delete' has explicitly asked to be
			// erased. Don't undelete the cascade; do clear the User row's deletedAt
			// so JWT works. Frontend reads deletionStatus and shows cancel screen.
			const isPendingHardDelete = user.deletionStatus === "pending_hard_delete";
			if (user.deletedAt && !isPendingHardDelete) {
				await this.undeleteUser(user.id);
				user.deletedAt = undefined;
				mutated = true;
				this.events.emit(USER_UNDELETED, { userId: user.id } satisfies UserUndeletedEvent);
			} else if (user.deletedAt && isPendingHardDelete) {
				await this.entityManager
					.getConnection()
					.execute(`update "user" set "deleted_at" = null where "id" = ?`, [user.id]);
				user.deletedAt = undefined;
				mutated = true;
			}
			if (!user.isEmailVerified) {
				// Google verifies the email; trust that.
				user.isEmailVerified = true;
				mutated = true;
			}
			if (!user.avatar && picture) {
				user.avatar = picture;
				mutated = true;
			}
			if (desiredRole && user.role !== desiredRole) {
				user.role = desiredRole;
				mutated = true;
			}
			if (mutated) {
				await this.entityManager.persist(user).flush();
			}
			await this.upsertGoogleAuthMethod(user, googleId);
		}

		const accessToken = await this.sessionService.createSession(user.id, {
			userAgent:
				typeof sessionContext?.userAgent === "string"
					? sessionContext.userAgent
					: sessionContext?.userAgent?.join(", "),
			ipAddress: sessionContext?.ipAddress,
		});

		this.emitLoginAttempt("success");

		return {
			accessToken,
			user: toUserResponseDto(user, this.config.analytics.salt),
		};
	}

	// Idempotent: if the (provider, providerId) row already exists, just bump
	// lastUsedAt; otherwise create it pointing at the User. Used both during
	// fresh signup and on every subsequent Google login.
	private async upsertGoogleAuthMethod(user: User, googleId: string): Promise<void> {
		const existing = await this.authMethodRepository.findOne({ provider: "google", providerId: googleId });
		if (existing) {
			existing.lastUsedAt = new Date();
			await this.entityManager.persist(existing).flush();
			return;
		}
		const method = this.authMethodRepository.create({
			user: user.id,
			provider: "google",
			providerId: googleId,
			lastUsedAt: new Date(),
		});
		await this.entityManager.persist(method).flush();
	}

	// Returns the role this user should have based on ADMIN_EMAILS, or null if
	// reconciliation is disabled (env unset/empty) — in which case the existing
	// role on the row is preserved. See ADR-0015.
	private resolveDesiredRole(email: string): UserRole | null {
		const allowlist = this.config.auth.adminEmails;
		if (allowlist.length === 0) {
			return null;
		}
		return allowlist.includes(email.toLowerCase()) ? "admin" : "user";
	}

	private classifyVerificationError(error: unknown): AuthLoginResult {
		if (!(error instanceof UnauthorizedException)) return "verification_error";
		const message = (error as UnauthorizedException).message;
		if (message?.toLowerCase().includes("email")) return "email_missing";
		return "invalid_token";
	}

	private emitLoginAttempt(result: AuthLoginResult) {
		this.events.emit(AUTH_LOGIN_ATTEMPTED, {
			provider: "google",
			result,
		} satisfies AuthLoginAttemptedEvent);
	}

	private async undeleteUser(userId: number): Promise<void> {
		await this.entityManager.getConnection().execute(`update "user" set "deleted_at" = null where "id" = ?`, [userId]);
		await this.entityManager
			.getConnection()
			.execute(`update "route" set "deleted_at" = null where "user_id" = ?`, [userId]);
	}

	async logout(jti: string): Promise<void> {
		await this.sessionService.invalidateSession(jti);
	}
}
