import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { RoutesModule } from "./routes/routes.module";
import config from "./mikro-orm.config";

@Module({
  imports: [MikroOrmModule.forRoot(config), UsersModule, AuthModule, RoutesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
