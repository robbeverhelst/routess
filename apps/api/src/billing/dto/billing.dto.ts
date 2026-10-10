import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { USER_PLANS, type UserPlan } from "../../entities/user.entity";
import { BILLING_OFFERS, type BillingOffer } from "../offers";

export class OfferPriceDto {
	@ApiProperty({ example: 2999, description: "Minor units (cents), VAT-inclusive" })
	amount!: number;

	@ApiProperty({ example: "eur" })
	currency!: string;
}

export class BillingOfferDto {
	@ApiProperty({ enum: BILLING_OFFERS, example: "pro_year_pass" })
	id!: BillingOffer;

	@ApiProperty({ enum: USER_PLANS, example: "pro" })
	plan!: UserPlan;

	@ApiProperty({ example: 365, description: "Days of the Plan one purchase adds" })
	days!: number;

	@ApiProperty({
		type: OfferPriceDto,
		nullable: true,
		description: "Read from the provider for display; null when unavailable. Checkout is authoritative.",
	})
	price!: OfferPriceDto | null;
}

export class GenerationQuotaDto {
	@ApiProperty({ example: 1, description: "Signed-out, per IP. 0 means no cap." })
	anonymous!: number;

	@ApiProperty({ example: 3 })
	free!: number;

	@ApiProperty({ example: 50 })
	pro!: number;
}

export class BillingAccountDto {
	@ApiProperty({ enum: USER_PLANS, example: "pro", description: "The Plan in effect now" })
	plan!: UserPlan;

	@ApiProperty({
		type: String,
		nullable: true,
		example: "2027-10-10T12:00:00.000Z",
		description: "When Pro ends. Null with plan 'pro' means Pro does not expire.",
	})
	proExpiresAt!: string | null;

	@ApiProperty({
		type: String,
		nullable: true,
		description: "End of the one-time OG grant, when this account received it",
	})
	ogGrantExpiresAt!: string | null;

	@ApiProperty({ description: "Whether a pass can be bought (or extended) now" })
	canBuy!: boolean;
}

export class BillingStatusDto {
	@ApiProperty({ description: "False on instances with BILLING_ENABLED=false; nothing else is sent then." })
	enabled!: boolean;

	@ApiPropertyOptional({ type: BillingOfferDto })
	offer?: BillingOfferDto;

	@ApiPropertyOptional({ type: GenerationQuotaDto, description: "Daily RouteGeneration allowance per tier" })
	generationPerDay?: GenerationQuotaDto;

	@ApiPropertyOptional({ type: BillingAccountDto, nullable: true, description: "Null when signed out" })
	account?: BillingAccountDto | null;
}

export class StartCheckoutDto {
	@ApiPropertyOptional({ enum: BILLING_OFFERS, default: "pro_year_pass" })
	@IsOptional()
	@IsIn(BILLING_OFFERS)
	offer?: BillingOffer;
}

export class CheckoutResponseDto {
	@ApiProperty({ example: "https://checkout.stripe.com/c/pay/cs_test_..." })
	url!: string;
}

export class WebhookResponseDto {
	@ApiProperty({ example: true })
	received!: boolean;
}
