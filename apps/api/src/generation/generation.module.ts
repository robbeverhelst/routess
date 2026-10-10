import { Module } from "@nestjs/common";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { RoutingModule } from "../routing/routing.module";
import { GenerationController } from "./generation.controller";
import { GenerationService } from "./generation.service";

@Module({
	imports: [RoutingModule, EntitlementsModule],
	controllers: [GenerationController],
	providers: [GenerationService],
})
export class GenerationModule {}
