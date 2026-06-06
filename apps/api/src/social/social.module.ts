import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { Follow } from "../entities/follow.entity";
import { Route } from "../entities/route.entity";
import { RouteShare } from "../entities/route-share.entity";
import { User } from "../entities/user.entity";
import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";

@Module({
	imports: [MikroOrmModule.forFeature([User, Route, Follow, RouteShare]), EmailModule],
	controllers: [SocialController],
	providers: [SocialService],
})
export class SocialModule {}
