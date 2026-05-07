import { randomUUID } from "node:crypto";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { MetricsService } from "../telemetry/metrics.service";

const LAST_ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class SessionService {
	constructor(
		@InjectRepository(Session)
		private readonly sessionRepository: EntityRepository<Session>,
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly em: EntityManager,
		private readonly jwtService: JwtService,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly metricsService: MetricsService,
	) {}

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

		await this.em.persistAndFlush(session);
		await this.syncActiveUsersMetric();

		return this.jwtService.sign({ sub: userId, email: user.email, jti });
	}

	async validateSession(jti: string): Promise<Session | null> {
		const session = await this.sessionRepository.findOne({
			jti,
			expiresAt: { $gt: new Date() },
			deletedAt: null,
		});

		if (session) {
			const now = new Date();
			const lastActivityAt = session.lastActivity?.getTime() ?? 0;
			if (now.getTime() - lastActivityAt >= LAST_ACTIVITY_UPDATE_INTERVAL_MS) {
				session.lastActivity = now;
				await this.em.persistAndFlush(session);
			}
		}

		return session;
	}

	// Single-query variant used on the auth-guard hot path: validates the
	// session and returns the owning User (skipping soft-deleted users) in
	// one populated load.
	async resolveAuthenticatedUser(jti: string): Promise<User | null> {
		const session = await this.sessionRepository.findOne(
			{ jti, expiresAt: { $gt: new Date() }, deletedAt: null },
			{ populate: ["user"] },
		);
		if (!session) return null;

		const now = new Date();
		const lastActivityAt = session.lastActivity?.getTime() ?? 0;
		if (now.getTime() - lastActivityAt >= LAST_ACTIVITY_UPDATE_INTERVAL_MS) {
			session.lastActivity = now;
			await this.em.persistAndFlush(session);
		}

		// Populated Ref behaves as the entity at runtime; cast through unknown
		// because the Ref<T> type-level wrapper lies about that shape.
		const user = session.user as unknown as User;
		if (!user || user.deletedAt) return null;
		return user;
	}

	async invalidateSession(jti: string): Promise<void> {
		const session = await this.sessionRepository.findOne({ jti, deletedAt: null });
		if (session) {
			session.deletedAt = new Date();
			await this.em.persistAndFlush(session);
			await this.syncActiveUsersMetric();
		}
	}

	async cleanupExpiredSessions(): Promise<number> {
		const expiredSessions = await this.sessionRepository.find({
			expiresAt: { $lt: new Date() },
			deletedAt: null,
		});

		for (const session of expiredSessions) {
			session.deletedAt = new Date();
		}

		await this.em.flush();
		await this.syncActiveUsersMetric();

		return expiredSessions.length;
	}

	async getActiveSessionsCount(): Promise<number> {
		return this.sessionRepository.count({
			expiresAt: { $gt: new Date() },
			deletedAt: null,
		});
	}

	async getUserActiveSessions(userId: number): Promise<Session[]> {
		return this.sessionRepository.find({
			user: userId,
			expiresAt: { $gt: new Date() },
			deletedAt: null,
		});
	}

	async invalidateUserSessions(userId: number): Promise<void> {
		const sessions = await this.sessionRepository.find({ user: userId, deletedAt: null });
		const deletedAt = new Date();

		for (const session of sessions) {
			session.deletedAt = deletedAt;
		}

		await this.em.flush();
		await this.syncActiveUsersMetric();
	}

	private async syncActiveUsersMetric(): Promise<void> {
		const result = (await this.em.getConnection().execute<{ count: number }[]>(
			`select count(distinct("user_id"))::int as count
			 from "session"
			 where "expires_at" > now() and "deleted_at" is null`,
		)) as Array<{ count: number | string }>;

		this.metricsService.setActiveUsers(Number(result[0]?.count || 0));
	}
}
