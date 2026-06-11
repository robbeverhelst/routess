import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { Route } from "../entities/route.entity";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { ExternalRoutesModule } from "../external-routes/external-routes.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
	imports: [MikroOrmModule.forFeature([User, Route, Session]), AuthModule, ExternalRoutesModule],
	controllers: [AdminController],
	providers: [AdminService],
})
export class AdminModule {}
