import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { User } from "../entities/user.entity";
import { USER_REGISTERED, type UserRegisteredEvent } from "../telemetry/domain-events";
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
	) {}

	async googleAuth(
		googleAuthDto: GoogleAuthDto,
		sessionContext?: {
			userAgent?: string | string[];
			ipAddress?: string;
		},
	): Promise<AuthResponseDto> {
		const identity = await this.googleIdentityVerifier.verify(googleAuthDto.credential);
		const { googleId, email, name, picture } = identity;

		let user = await this.userRepository.findOne({
			$or: [{ googleId }, { email }],
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
			this.events.emit(USER_REGISTERED, { source: "google" } satisfies UserRegisteredEvent);
		} else if (!user.googleId) {
			user.googleId = googleId;
			user.avatar = picture;
			user.isEmailVerified = true;
			await this.entityManager.persistAndFlush(user);
		}

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
