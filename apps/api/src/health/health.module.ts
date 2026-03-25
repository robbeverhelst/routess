import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";

@Module({
	imports: [TerminusModule, MikroOrmModule],
	controllers: [HealthController],
})
export class HealthModule {}
