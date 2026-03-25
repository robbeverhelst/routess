import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ScheduleModule } from "@nestjs/schedule";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { SessionCleanupService } from "./session-cleanup.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
	imports: [
		MikroOrmModule.forFeature([User, Session]),
		PassportModule.register({ defaultStrategy: "jwt" }),
		ScheduleModule.forRoot(),
		JwtModule.registerAsync({
			useFactory: () => {
				const secret = process.env.JWT_SECRET || "your-secret-key";
				return {
					secret: secret,
					signOptions: { expiresIn: "7d" },
				};
			},
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, SessionService, SessionCleanupService, JwtStrategy],
	exports: [AuthService, SessionService, JwtStrategy],
})
export class AuthModule {}
