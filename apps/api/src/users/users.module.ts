import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { RouteLibraryModule } from "../route-library/route-library.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
	imports: [MikroOrmModule.forFeature([User, Route]), AuthModule, RouteLibraryModule],
	controllers: [UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
