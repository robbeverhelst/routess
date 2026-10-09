import { Module } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG, ConfigModule } from "../config/config.module";
import { BillingService } from "./billing.service";
import { BILLING_PROVIDER, type BillingProvider } from "./billing-provider";

// No provider implementation ships until ADR 0039 picks one. Enabled billing
// without one would boot an API that cannot take a payment, so refuse to start.
export function createBillingProvider(billing: AppConfig["billing"]): BillingProvider | null {
	if (!billing.enabled) {
		return null;
	}
	const requested = billing.provider ? ` (BILLING_PROVIDER=${billing.provider})` : "";
	throw new Error(`BILLING_ENABLED=true but no billing provider is implemented yet${requested}`);
}

@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: BILLING_PROVIDER,
			inject: [APP_CONFIG],
			useFactory: (config: AppConfig) => createBillingProvider(config.billing),
		},
		BillingService,
	],
	exports: [BillingService],
})
export class BillingModule {}
