import { Module } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG, ConfigModule } from "../config/config.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { BILLING_PROVIDER, type BillingProvider } from "./billing-provider";
import { StripeBillingProvider } from "./stripe-billing.provider";

// Billing off (the default, and always on self-hosted instances) means no
// provider, and every billing route answers 503. Billing on without every
// value Stripe needs would boot an API that cannot take a payment (or forgets
// the OG grant), so startup fails and names what is missing.
export function createBillingProvider(billing: AppConfig["billing"]): BillingProvider | null {
	if (!billing.enabled) {
		return null;
	}
	if (billing.provider !== "stripe") {
		throw new Error("BILLING_ENABLED=true needs BILLING_PROVIDER=stripe (or unset), the only provider implemented");
	}
	const missing = [
		["STRIPE_SECRET_KEY", billing.stripe.secretKey],
		["STRIPE_WEBHOOK_SECRET", billing.stripe.webhookSecret],
		["STRIPE_PRICE_PRO_YEAR_PASS", billing.stripe.proYearPassPriceId],
		["BILLING_LAUNCHED_AT", billing.launchedAt],
	]
		.filter(([, value]) => !value)
		.map(([name]) => name);
	if (missing.length > 0) {
		throw new Error(`BILLING_ENABLED=true but ${missing.join(", ")} is not set`);
	}
	return new StripeBillingProvider(billing.stripe);
}

@Module({
	imports: [ConfigModule, EntitlementsModule],
	controllers: [BillingController],
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
