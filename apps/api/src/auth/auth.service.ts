import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { type AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { User } from "../entities/user.entity";
import { MetricsService } from "../telemetry/metrics.service";
import { toUserResponseDto } from "../users/user.mapper";
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
		let payload: TokenPayload | undefined;
		try {
			const ticket = await this.googleClient.verifyIdToken({
				idToken: googleAuthDto.credential,
				audience: this.config.auth.googleClientId,
			});
			payload = ticket.getPayload();
		} catch (error) {
			this.logger.warn(`Google token verification failed: ${error instanceof Error ? error.message : String(error)}`);
			throw new UnauthorizedException("Failed to authenticate with Google");
		}

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
		} else if (!user.googleId) {
			user.googleId = googleId;
			user.avatar = picture;
			user.isEmailVerified = true;
			await this.entityManager.persistAndFlush(user);
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
	}

	async logout(jti: string): Promise<void> {
		await this.sessionService.invalidateSession(jti);
	}
}
