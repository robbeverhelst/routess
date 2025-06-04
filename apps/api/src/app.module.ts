import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './db/db.service';
import { User } from './entities/user.entity';
import { UsersController } from './users/users.controller';
import config from './mikro-orm.config';

@Module({
  imports: [MikroOrmModule.forRoot(config), MikroOrmModule.forFeature([User])],
  controllers: [AppController, UsersController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
