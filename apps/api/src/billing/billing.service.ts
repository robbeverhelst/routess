import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { User } from "../entities/user.entity";
import {
	BILLING_PROVIDER,
	type BillingEvent,
	type BillingProvider,
	type CheckoutRequest,
	type CheckoutSession,
	type WebhookDelivery,
} from "./billing-provider";

// Skeleton of the payments flow (#135, ADR 0039): hosted checkout out, webhook
// in, Plan written from the webhook only. Nothing calls it yet; with billing
// off (the default) every entry point refuses with 503.
@Injectable()
export class BillingService {
	private readonly logger = new Logger(BillingService.name);

	constructor(
		@Inject(BILLING_PROVIDER) private readonly provider: BillingProvider | null,
		private readonly em: EntityManager,
	) {}

	get enabled(): boolean {
		return this.provider !== null;
	}

	async startCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
		return this.requireProvider().createCheckout(request);
	}

	async handleWebhook(delivery: WebhookDelivery): Promise<void> {
		const event = await this.requireProvider().parseWebhook(delivery);
		if (event) {
			await this.applyEvent(event);
		}
	}

	// Idempotent: providers redeliver webhooks, and setting the same Plan twice
	// is a no-op.
	async applyEvent(event: BillingEvent): Promise<void> {
		const user = await this.em.findOne(User, { id: event.userId });
		if (!user) {
			throw new NotFoundException(`User with ID ${event.userId} not found`);
		}
		if (user.plan !== event.plan) {
			this.logger.log(`User ${user.id} plan ${user.plan} -> ${event.plan} (${event.providerRef})`);
			user.plan = event.plan;
			await this.em.flush();
		}
	}

	private requireProvider(): BillingProvider {
		if (!this.provider) {
			throw new ServiceUnavailableException("Billing is not enabled on this instance");
		}
		return this.provider;
	}
}
