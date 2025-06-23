import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule, MikroOrmModule],
  controllers: [HealthController],
})
export class HealthModule {}
