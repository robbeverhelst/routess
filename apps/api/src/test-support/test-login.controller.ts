import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { PasswordService } from "../auth/password.service";
import { SessionService } from "../auth/session.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { User } from "../entities/user.entity";
import { UserAuthMethod } from "../entities/user-auth-method.entity";
import { toUserResponseDto } from "../users/user.mapper";

interface TestLoginBody {
	email: string;
}

interface TestSeedUserBody {
	email: string;
	password: string;
	name?: string;
}

@Controller("test")
export class TestLoginController {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		@InjectRepository(UserAuthMethod)
		private readonly authMethodRepository: EntityRepository<UserAuthMethod>,
		private readonly em: EntityManager,
		private readonly sessionService: SessionService,
		private readonly passwordService: PasswordService,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	@Post("login")
	async login(@Body() body: TestLoginBody, @Headers("x-test-secret") secret: string) {
		this.assertSecret(secret);

		const email = body.email.toLowerCase();
		let user = await this.userRepository.findOne({ email }, { filters: { softDelete: false } });

		if (!user) {
			const adminEmails = this.config.auth.adminEmails;
			const role = adminEmails.length > 0 && adminEmails.includes(email) ? "admin" : "user";
			user = this.userRepository.create({
				email,
				name: email,
				isEmailVerified: true,
				role,
				deletionStatus: "active",
			});
			await this.em.persistAndFlush(user);
			const method = this.authMethodRepository.create({
				user: user.id,
				provider: "google",
				providerId: `e2e-${email}`,
				lastUsedAt: new Date(),
			});
			await this.em.persistAndFlush(method);
		} else if (user.deletedAt) {
			user.deletedAt = undefined;
			await this.em.persistAndFlush(user);
		}

		const accessToken = await this.sessionService.createSession(user.id);
		return { accessToken, user: toUserResponseDto(user, this.config.analytics.salt, false) };
	}

	// Seeds a User with an email+password auth method, bypassing the
	// signup-email → verify-email round-trip. The spec can then exercise the
	// real POST /auth/login-email endpoint and the full sign-in UI flow.
	@Post("seed-user")
	async seedUser(@Body() body: TestSeedUserBody, @Headers("x-test-secret") secret: string) {
		this.assertSecret(secret);

		const email = body.email.toLowerCase();
		let user = await this.userRepository.findOne({ email }, { filters: { softDelete: false } });
		if (!user) {
			const adminEmails = this.config.auth.adminEmails;
			const role = adminEmails.length > 0 && adminEmails.includes(email) ? "admin" : "user";
			user = this.userRepository.create({
				email,
				name: body.name ?? email,
				isEmailVerified: true,
				role,
				deletionStatus: "active",
			});
			await this.em.persistAndFlush(user);
		}

		const existing = await this.authMethodRepository.findOne({ provider: "email", providerId: email });
		const passwordHash = await this.passwordService.hash(body.password);
		if (existing) {
			existing.passwordHash = passwordHash;
			await this.em.persistAndFlush(existing);
		} else {
			const method = this.authMethodRepository.create({
				user: user.id,
				provider: "email",
				providerId: email,
				passwordHash,
				lastUsedAt: new Date(),
			});
			await this.em.persistAndFlush(method);
		}

		return { success: true };
	}

	private assertSecret(secret: string | undefined): void {
		if (!process.env.E2E_TEST_LOGIN_SECRET || process.env.E2E_TEST_LOGIN_SECRET !== secret) {
			throw new UnauthorizedException();
		}
	}
}
