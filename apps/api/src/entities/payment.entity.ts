import { type Rel } from "@mikro-orm/core";
import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type { BillingOffer } from "../billing/offers";
import type { BillingProviderName } from "../config/app-config";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

// CONTEXT.md "Payment": one paid checkout for a Pro pass (ADR 0039). The row
// is the webhook's idempotency record (provider event id and checkout ref are
// both unique) and the bookkeeping trail, so it outlives its User: a hard
// delete only clears user_id.
@Entity()
export class Payment extends BaseEntity {
	@PrimaryKey()
	id!: number;

	@ManyToOne(() => User, { nullable: true, deleteRule: "set null" })
	user?: Rel<User> | null;

	@Property({ type: "string" })
	provider!: BillingProviderName;

	@Property({ type: "string", unique: true })
	eventId!: string;

	@Property({ type: "string", unique: true })
	checkoutRef!: string;

	@Property({ type: "string" })
	offer!: BillingOffer;

	// Minor units (cents), VAT-inclusive, as the provider reported it.
	@Property({ type: "integer", nullable: true })
	amountTotal?: number | null;

	@Property({ type: "string", nullable: true })
	currency?: string | null;

	@Property({ type: "timestamp" })
	paidAt!: Date;

	// The Pro expiry this payment produced. Null when the User was already gone
	// by the time the webhook arrived (refund by hand).
	@Property({ type: "timestamp", nullable: true })
	passExpiresAt?: Date | null;
}
