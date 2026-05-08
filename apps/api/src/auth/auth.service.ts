import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { User, type UserRole } from "../entities/user.entity";
import {
	AUTH_LOGIN_ATTEMPTED,
	type AuthLoginAttemptedEvent,
	type AuthLoginResult,
	USER_REGISTERED,
	USER_UNDELETED,
	type UserRegisteredEvent,
	type UserUndeletedEvent,
} from "../telemetry/domain-events";
import { toUserResponseDto } from "../users/user.mapper";
import type { AuthResponseDto, GoogleAuthDto } from "./dto";
import { GOOGLE_IDENTITY_VERIFIER, type GoogleIdentityVerifier } from "./google-identity-verifier";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User)
		private userRepository: EntityRepository<User>,
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
		let identity;
		try {
			identity = await this.googleIdentityVerifier.verify(googleAuthDto.credential);
		} catch (error) {
			const result = this.classifyVerificationError(error);
			this.emitLoginAttempt(result);
			throw error;
		}

		const { googleId, email, name, picture } = identity;

		// Find any matching user, including soft-deleted, so we can run the relogin-undelete flow.
		let user = await this.userRepository.findOne(
			{ $or: [{ googleId }, { email }] },
			{ filters: { softDelete: false } },
		);

		const desiredRole = this.resolveDesiredRole(email);

		if (!user) {
			user = this.userRepository.create({
				email,
				name: name || email,
				googleId,
				avatar: picture,
				isEmailVerified: true,
				role: desiredRole ?? "user",
			});
			await this.entityManager.persistAndFlush(user);
			this.events.emit(USER_REGISTERED, { source: "google" } satisfies UserRegisteredEvent);
		} else {
			let mutated = false;
			if (user.deletedAt) {
				await this.undeleteUser(user.id);
				user.deletedAt = undefined;
				mutated = true;
				this.events.emit(USER_UNDELETED, { userId: user.id } satisfies UserUndeletedEvent);
			}
			if (!user.googleId) {
				user.googleId = googleId;
				user.avatar = picture;
				user.isEmailVerified = true;
				mutated = true;
			}
			if (desiredRole && user.role !== desiredRole) {
				user.role = desiredRole;
				mutated = true;
			}
			if (mutated) {
				await this.entityManager.persistAndFlush(user);
			}
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
			user: toUserResponseDto(user),
		};
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
		await this.entityManager
			.getConnection()
			.execute(`update "user" set "deleted_at" = null where "id" = ?`, [userId]);
		await this.entityManager
			.getConnection()
			.execute(`update "route" set "deleted_at" = null where "user_id" = ?`, [userId]);
	}

	async logout(jti: string): Promise<void> {
		await this.sessionService.invalidateSession(jti);
	}
}
