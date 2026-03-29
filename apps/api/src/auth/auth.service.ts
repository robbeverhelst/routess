import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { type AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { User } from "../entities/user.entity";
import { MetricsService } from "../telemetry/metrics.service";
import { toUserProfileDto, toUserResponseDto } from "../users/user.mapper";
import type { AuthResponseDto, GoogleAuthDto } from "./dto";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	private googleClient: OAuth2Client;

	constructor(
		@InjectRepository(User)
		private userRepository: EntityRepository<User>,
		private entityManager: EntityManager,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private metricsService: MetricsService,
		private sessionService: SessionService,
	) {
		this.googleClient = new OAuth2Client(this.config.auth.googleClientId);
	}

	async googleAuth(
		googleAuthDto: GoogleAuthDto,
		sessionContext?: {
			userAgent?: string | string[];
			ipAddress?: string;
		},
	): Promise<AuthResponseDto> {
		try {
			const ticket = await this.googleClient.verifyIdToken({
				idToken: googleAuthDto.credential,
				audience: this.config.auth.googleClientId,
			});

			const payload = ticket.getPayload();
			if (!payload) {
				throw new UnauthorizedException("Invalid Google token");
			}

			const { sub: googleId, email, name, picture } = payload;

			if (!email) {
				throw new UnauthorizedException("Email not provided by Google");
			}

			let user = await this.userRepository.findOne({
				$or: [{ googleId }, { email }],
				deletedAt: null,
			});

			if (!user) {
				user = this.userRepository.create({
					email,
					name: name || email,
					googleId,
					avatar: picture,
					isEmailVerified: true,
				});
				await this.entityManager.persistAndFlush(user);

				// Record new user registration metric
				this.metricsService.recordUserRegistration("google");
			} else {
				if (!user.googleId) {
					user.googleId = googleId;
					user.avatar = picture;
					user.isEmailVerified = true;
					await this.entityManager.persistAndFlush(user);
				}
			}

			// Create session and get JWT with session tracking
			const accessToken = await this.sessionService.createSession(user.id, {
				userAgent:
					typeof sessionContext?.userAgent === "string"
						? sessionContext.userAgent
						: sessionContext?.userAgent?.join(", "),
				ipAddress: sessionContext?.ipAddress,
			});

			return {
				accessToken,
				user: toUserResponseDto(user),
			};
		} catch (error) {
			this.logger.warn(
				`Google authentication failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new UnauthorizedException("Failed to authenticate with Google");
		}
	}

	async validateUserById(userId: number): Promise<User | null> {
		return this.userRepository.findOne({ id: userId, deletedAt: null });
	}

	async getProfile(userId: number) {
		const user = await this.userRepository.findOne({ id: userId, deletedAt: null });
		if (!user) {
			throw new UnauthorizedException("User not found");
		}

		const statistics = await this.sessionService.getUserStatistics(userId);
		return toUserProfileDto(user, statistics);
	}

	async logout(jti: string): Promise<void> {
		await this.sessionService.invalidateSession(jti);
	}
}
