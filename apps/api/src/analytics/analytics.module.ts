import { Module } from "@nestjs/common";
import { AnalyticsErasureService } from "./analytics-erasure.service";
import { ProductEventStatsService } from "./product-event-stats.service";

@Module({
	providers: [AnalyticsErasureService, ProductEventStatsService],
	exports: [AnalyticsErasureService, ProductEventStatsService],
})
export class AnalyticsModule {}
