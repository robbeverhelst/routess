import { randomUUID } from "node:crypto";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import {
	AUTH_SESSION_REVOKED,
	type AuthSessionRevokedEvent,
	SESSION_ACTIVITY_CHANGED,
	type SessionRevocationReason,
} from "../telemetry/domain-events";

const LAST_ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class SessionService {
	private readonly logger = new Logger(SessionService.name);

	constructor(
		@InjectRepository(Session)
		private readonly sessionRepository: EntityRepository<Session>,
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly em: EntityManager,
		private readonly jwtService: JwtService,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly events: EventEmitter2,
	) {}

	@Cron(CronExpression.EVERY_HOUR)
	async cleanupExpiredSessionsHourly(): Promise<void> {
		try {
			const cleanedCount = await this.cleanupExpiredSessions();
			if (cleanedCount > 0) {
				this.logger.log(`Cleaned up ${cleanedCount} expired sessions`);
			}
		} catch (error) {
			// The bare message told us nothing for the hour-by-hour failures in
			// #354. Log the stack, and the cause a driver error carries.
			this.logger.error(
				`Failed to cleanup expired sessions: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async createSession(
		userId: number,
		context?: {
			userAgent?: string;
			ipAddress?: string;
		},
	): Promise<string> {
		const user = await this.userRepository.findOneOrFail({ id: userId });
		const jti = randomUUID();
		const expiresAt = new Date(Date.now() + this.config.auth.sessionTtlMs);

		const session = this.sessionRepository.create({
			jti,
			user: user.id,
			expiresAt,
			lastActivity: new Date(),
			userAgent: context?.userAgent,
			ipAddress: context?.ipAddress,
		});

		await this.em.persist(session).flush();
		this.events.emit(SESSION_ACTIVITY_CHANGED);

		return this.jwtService.sign({ sub: userId, email: user.email, jti });
	}

	async validateSession(jti: string): Promise<Session | null> {
		const session = await this.sessionRepository.findOne({
			jti,
			expiresAt: { $gt: new Date() },
		});

		if (session) {
			const now = new Date();
			const lastActivityAt = session.lastActivity?.getTime() ?? 0;
			if (now.getTime() - lastActivityAt >= LAST_ACTIVITY_UPDATE_INTERVAL_MS) {
				session.lastActivity = now;
				await this.em.persist(session).flush();
			}
		}

		return session;
	}

	// Single-query variant used on the auth-guard hot path: validates the
	// session and returns the owning User (skipping soft-deleted users) in
	// one populated load.
	async resolveAuthenticatedUser(jti: string): Promise<User | null> {
		const session = await this.sessionRepository.findOne(
			{ jti, expiresAt: { $gt: new Date() } },
			{ populate: ["user"] },
		);
		if (!session) return null;

		// Rolling session: active use slides expiresAt forward so a continuously
		// used session never hits the absolute TTL. Throttled to the same window
		// as the lastActivity bump to keep this off the per-request write path;
		// the cookie's JWT is re-issued every request by SessionRefreshInterceptor.
		const now = new Date();
		const lastActivityAt = session.lastActivity?.getTime() ?? 0;
		if (now.getTime() - lastActivityAt >= LAST_ACTIVITY_UPDATE_INTERVAL_MS) {
			session.lastActivity = now;
			session.expiresAt = new Date(now.getTime() + this.config.auth.sessionTtlMs);
			await this.em.persist(session).flush();
		}

		// Populated Ref behaves as the entity at runtime; cast through unknown
		// because the Ref<T> type-level wrapper lies about that shape.
		const user = session.user;
		if (!user || user.deletedAt) return null;
		return user;
	}

	async invalidateSession(jti: string, reason: SessionRevocationReason = "logout"): Promise<void> {
		const session = await this.sessionRepository.findOne({ jti });
		if (session) {
			session.deletedAt = new Date();
			await this.em.persist(session).flush();
			this.events.emit(SESSION_ACTIVITY_CHANGED);
			this.emitRevoked(reason, 1);
		}
	}

	// One indexed bulk UPDATE rather than hydrating every expired Session and
	// flushing a statement each (#354). That also makes the hourly @Cron safe to
	// run on every replica without leader election: whichever pod gets there
	// first soft-deletes the rows, and the others match nothing and emit
	// nothing, so the telemetry below still counts each expiry once.
	async cleanupExpiredSessions(): Promise<number> {
		const affected = await this.sessionRepository.nativeUpdate(
			{ expiresAt: { $lt: new Date() }, deletedAt: null },
			{ deletedAt: new Date() },
		);

		if (affected > 0) {
			this.events.emit(SESSION_ACTIVITY_CHANGED);
			this.emitRevoked("expired", affected);
		}

		return affected;
	}

	async getActiveSessionsCount(): Promise<number> {
		return this.sessionRepository.count({
			expiresAt: { $gt: new Date() },
		});
	}

	async getUserActiveSessions(userId: number): Promise<Session[]> {
		return this.sessionRepository.find({
			user: userId,
			expiresAt: { $gt: new Date() },
		});
	}

	async invalidateUserSessions(userId: number, reason: SessionRevocationReason = "invalidated"): Promise<void> {
		const sessions = await this.sessionRepository.find({ user: userId });
		const deletedAt = new Date();

		for (const session of sessions) {
			session.deletedAt = deletedAt;
		}

		await this.em.flush();

		if (sessions.length > 0) {
			this.events.emit(SESSION_ACTIVITY_CHANGED);
			this.emitRevoked(reason, sessions.length);
		}
	}

	private emitRevoked(reason: SessionRevocationReason, count: number) {
		this.events.emit(AUTH_SESSION_REVOKED, {
			reason,
			count,
		} satisfies AuthSessionRevokedEvent);
	}
}
