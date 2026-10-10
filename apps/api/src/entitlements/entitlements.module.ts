import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { EntitlementsService, PLAN_FEATURE_MATRIX } from "./entitlements.service";
import { PLAN_FEATURES } from "./features";

@Module({
	imports: [ConfigModule],
	providers: [EntitlementsService, { provide: PLAN_FEATURE_MATRIX, useValue: PLAN_FEATURES }],
	exports: [EntitlementsService],
})
export class EntitlementsModule {}
