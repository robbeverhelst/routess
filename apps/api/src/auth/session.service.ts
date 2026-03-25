import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { MetricsService } from "../telemetry/metrics.service";

@Injectable()
export class SessionService {
	constructor(
		@InjectRepository(Session)
		private readonly sessionRepository: EntityRepository<Session>,
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly em: EntityManager,
		private readonly jwtService: JwtService,
		readonly _metricsService: MetricsService,
	) {}

	async createSession(userId: number, userAgent?: string, ipAddress?: string): Promise<string> {
		const user = await this.userRepository.findOneOrFail({ id: userId });
		const jti = uuidv4();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

		const session = this.sessionRepository.create({
			jti,
			user: user.id,
			expiresAt,
			lastActivity: new Date(),
			userAgent,
			ipAddress,
		});

		await this.em.persistAndFlush(session);

		// Update active users count
		await this.updateActiveUsersMetric();

		return this.jwtService.sign({ sub: userId, email: user.email, jti });
	}

	async validateSession(jti: string): Promise<Session | null> {
		const session = await this.sessionRepository.findOne({
			jti,
			expiresAt: { $gt: new Date() },
			deletedAt: null,
		});

		if (session) {
			// Update last activity
			session.lastActivity = new Date();
			await this.em.persistAndFlush(session);
		}

		return session;
	}

	async invalidateSession(jti: string): Promise<void> {
		const session = await this.sessionRepository.findOne({ jti, deletedAt: null });
		if (session) {
			session.deletedAt = new Date();
			await this.em.persistAndFlush(session);

			// Update active users count
			await this.updateActiveUsersMetric();
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

		// Update active users count after cleanup
		await this.updateActiveUsersMetric();

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

	private async updateActiveUsersMetric(): Promise<void> {
		try {
			// Get unique active users count
			const uniqueActiveUsers = await this.sessionRepository.count(
				{
					expiresAt: { $gt: new Date() },
					deletedAt: null,
				},
				{ groupBy: ["user"] },
			);

			// For simplicity, we'll let the metrics initialization handle the initial count
			// and this will be called when sessions are created/invalidated
			console.log(`Active sessions updated: ${uniqueActiveUsers} active sessions`);
		} catch (error) {
			console.error("Failed to update active users metric:", error);
		}
	}
}
