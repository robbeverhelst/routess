import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { User } from "../entities/user.entity";
import { MetricsService } from "../telemetry/metrics.service";
import type { AuthResponseDto, GoogleAuthDto } from "./dto";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
	private googleClient: OAuth2Client;

	constructor(
		@InjectRepository(User)
		private userRepository: EntityRepository<User>,
		private entityManager: EntityManager,
		_jwtService: JwtService,
		private metricsService: MetricsService,
		private sessionService: SessionService,
	) {
		this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
	}

	async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
		try {
			const ticket = await this.googleClient.verifyIdToken({
				idToken: googleAuthDto.credential,
				audience: process.env.GOOGLE_CLIENT_ID,
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
			const accessToken = await this.sessionService.createSession(user.id);

			return {
				accessToken,
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					avatar: user.avatar,
					isEmailVerified: user.isEmailVerified,
				},
			};
		} catch {
			throw new UnauthorizedException("Failed to authenticate with Google");
		}
	}

	async validateUserById(userId: number): Promise<User | null> {
		return this.userRepository.findOne({ id: userId, deletedAt: null });
	}

	async getProfile(userId: number): Promise<User> {
		const user = await this.userRepository.findOne({ id: userId, deletedAt: null });
		if (!user) {
			throw new UnauthorizedException("User not found");
		}
		return user;
	}

	async logout(jti: string): Promise<void> {
		await this.sessionService.invalidateSession(jti);
	}
}
