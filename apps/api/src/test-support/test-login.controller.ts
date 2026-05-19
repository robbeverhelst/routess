import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { SessionService } from "../auth/session.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { User } from "../entities/user.entity";
import { toUserResponseDto } from "../users/user.mapper";

interface TestLoginBody {
	email: string;
}

@Controller("test")
export class TestLoginController {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly em: EntityManager,
		private readonly sessionService: SessionService,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	@Post("login")
	async login(@Body() body: TestLoginBody, @Headers("x-test-secret") secret: string) {
		if (!process.env.E2E_TEST_LOGIN_SECRET || process.env.E2E_TEST_LOGIN_SECRET !== secret) {
			throw new UnauthorizedException();
		}

		const email = body.email.toLowerCase();
		let user = await this.userRepository.findOne({ email }, { filters: { softDelete: false } });

		if (!user) {
			const adminEmails = this.config.auth.adminEmails;
			const role = adminEmails.length > 0 && adminEmails.includes(email) ? "admin" : "user";
			user = this.userRepository.create({
				email,
				name: email,
				googleId: `e2e-${email}`,
				isEmailVerified: true,
				role,
			});
			await this.em.persistAndFlush(user);
		} else if (user.deletedAt) {
			user.deletedAt = undefined;
			await this.em.persistAndFlush(user);
		}

		const accessToken = await this.sessionService.createSession(user.id);
		return { accessToken, user: toUserResponseDto(user) };
	}
}
