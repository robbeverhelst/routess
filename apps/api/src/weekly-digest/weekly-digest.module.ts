import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { EmailModule } from "../email/email.module";
import { RoutesModule } from "../routes/routes.module";
import { UnsubscribeController } from "./unsubscribe.controller";
import { WeeklyDigestService } from "./weekly-digest.service";

@Module({
	imports: [ConfigModule, EmailModule, RoutesModule],
	controllers: [UnsubscribeController],
	providers: [WeeklyDigestService],
	exports: [WeeklyDigestService],
})
export class WeeklyDigestModule {}
