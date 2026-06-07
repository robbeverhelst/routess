import { Module } from "@nestjs/common";
import { PlacesService } from "./places.service";

@Module({
	providers: [PlacesService],
	exports: [PlacesService],
})
export class PlacesModule {}
