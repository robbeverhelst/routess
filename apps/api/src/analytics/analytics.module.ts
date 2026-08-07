import { Module } from "@nestjs/common";
import { AnalyticsErasureService } from "./analytics-erasure.service";

@Module({
	providers: [AnalyticsErasureService],
	exports: [AnalyticsErasureService],
})
export class AnalyticsModule {}
