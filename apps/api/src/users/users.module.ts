import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuthModule } from "../auth/auth.module";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { RouteLibraryModule } from "../route-library/route-library.module";
import { DataExportService } from "./data-export.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
	imports: [MikroOrmModule.forFeature([User, Route]), AuthModule, RouteLibraryModule, AnalyticsModule],
	controllers: [UsersController],
	providers: [UsersService, DataExportService],
	exports: [UsersService],
})
export class UsersModule {}
