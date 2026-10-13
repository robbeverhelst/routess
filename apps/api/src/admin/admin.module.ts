import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuthModule } from "../auth/auth.module";
import { Route } from "../entities/route.entity";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { ExternalRoutesModule } from "../external-routes/external-routes.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminProService } from "./admin-pro.service";

@Module({
	imports: [
		MikroOrmModule.forFeature([User, Route, Session]),
		AnalyticsModule,
		AuthModule,
		EntitlementsModule,
		ExternalRoutesModule,
	],
	controllers: [AdminController],
	providers: [AdminService, AdminProService],
})
export class AdminModule {}
