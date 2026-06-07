import { Module } from "@nestjs/common";
import { OverlaysController } from "./overlays.controller";
import { OverlaysService } from "./overlays.service";

@Module({
	controllers: [OverlaysController],
	providers: [OverlaysService],
})
export class OverlaysModule {}
