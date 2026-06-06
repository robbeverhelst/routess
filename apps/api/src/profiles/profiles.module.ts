import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { Follow } from "../entities/follow.entity";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
	imports: [MikroOrmModule.forFeature([User, Route, Follow])],
	controllers: [ProfilesController],
	providers: [ProfilesService],
	exports: [ProfilesService],
})
export class ProfilesModule {}
