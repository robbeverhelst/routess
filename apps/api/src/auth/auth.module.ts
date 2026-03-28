import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ScheduleModule } from "@nestjs/schedule";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG, ConfigModule } from "../config/config.module";
import { Route } from "../entities/route.entity";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { SessionCleanupService } from "./session-cleanup.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
	imports: [
		ConfigModule,
		MikroOrmModule.forFeature([User, Session, Route]),
		PassportModule.register({ defaultStrategy: "jwt" }),
		ScheduleModule.forRoot(),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [APP_CONFIG],
			useFactory: (config: AppConfig) => {
				return {
					secret: config.auth.jwtSecret,
					signOptions: { expiresIn: config.auth.jwtExpiresIn },
				};
			},
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, SessionService, SessionCleanupService, JwtStrategy],
	exports: [AuthService, SessionService, JwtStrategy],
})
export class AuthModule {}
