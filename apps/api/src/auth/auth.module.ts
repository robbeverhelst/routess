import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import type { JwtModuleOptions } from "@nestjs/jwt";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ScheduleModule } from "@nestjs/schedule";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG, ConfigModule } from "../config/config.module";
import { EmailModule } from "../email/email.module";
import { PersonalAccessToken } from "../entities/personal-access-token.entity";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { UserAuthMethod } from "../entities/user-auth-method.entity";
import { VerificationToken } from "../entities/verification-token.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailAuthService } from "./email-auth.service";
import { GOOGLE_IDENTITY_VERIFIER, GoogleOAuth2Verifier } from "./google-identity-verifier";
import { SessionRefreshInterceptor } from "./interceptors/session-refresh.interceptor";
import { PasswordService } from "./password.service";
import { PersonalAccessTokensController } from "./personal-access-tokens.controller";
import { PersonalAccessTokensService } from "./personal-access-tokens.service";
import { SessionService } from "./session.service";
import { SessionsController } from "./sessions.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { PatBearerStrategy } from "./strategies/pat-bearer.strategy";

@Module({
	imports: [
		ConfigModule,
		EmailModule,
		MikroOrmModule.forFeature([User, Session, UserAuthMethod, VerificationToken, PersonalAccessToken]),
		PassportModule.register({ defaultStrategy: "jwt" }),
		ScheduleModule.forRoot(),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [APP_CONFIG],
			useFactory: (config: AppConfig): JwtModuleOptions => {
				return {
					secret: config.auth.jwtSecret,
					signOptions: {
						expiresIn: config.auth.jwtExpiresIn as NonNullable<JwtModuleOptions["signOptions"]>["expiresIn"],
					},
				};
			},
		}),
	],
	controllers: [AuthController, SessionsController, PersonalAccessTokensController],
	providers: [
		AuthService,
		EmailAuthService,
		SessionService,
		PasswordService,
		JwtStrategy,
		PatBearerStrategy,
		PersonalAccessTokensService,
		{ provide: GOOGLE_IDENTITY_VERIFIER, useClass: GoogleOAuth2Verifier },
		{ provide: APP_INTERCEPTOR, useClass: SessionRefreshInterceptor },
	],
	exports: [
		AuthService,
		EmailAuthService,
		SessionService,
		PasswordService,
		JwtStrategy,
		PatBearerStrategy,
		PersonalAccessTokensService,
	],
})
export class AuthModule {}
