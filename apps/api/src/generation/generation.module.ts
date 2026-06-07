import { Module } from "@nestjs/common";
import { RoutingModule } from "../routing/routing.module";
import { GenerationController } from "./generation.controller";
import { GenerationService } from "./generation.service";

@Module({
	imports: [RoutingModule],
	controllers: [GenerationController],
	providers: [GenerationService],
})
export class GenerationModule {}
