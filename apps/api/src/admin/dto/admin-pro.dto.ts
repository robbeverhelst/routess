import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { SavedRoutesAllowanceDto } from "../../billing/dto/billing.dto";
import { GENERATION_QUOTA_TIERS, type GenerationQuotaTier } from "../../config/app-config";
import { ADMIN_AUDIT_ACTIONS, type AdminAuditAction } from "../../entities/admin-audit-entry.entity";
import { ENTITLEMENT_SOURCES, type EntitlementSource } from "../../entities/entitlement.entity";
import { USER_PLANS, type UserPlan } from "../../entities/user.entity";
import { PLAN_KINDS, type PlanKind } from "../../entitlements/plan-status";

export const MAX_ADMIN_GRANT_DAYS = 3650;

export class AdminUserPlanDto {
	@ApiProperty({
		enum: PLAN_KINDS,
		example: "pro_paid",
		description:
			"free, pro_paid (a paid pass), pro_admin (an admin or operator comp), pro_og (the OG grant), or pro_expired (free now, held Pro before). A paid pass wins over a comp, a comp over the OG grant.",
	})
	kind!: PlanKind;

	@ApiProperty({ enum: USER_PLANS, example: "pro", description: "The Plan in effect now, as the Pro gates see it" })
	plan!: UserPlan;

	@ApiPropertyOptional({
		nullable: true,
		example: "2027-10-13T08:59:00.000Z",
		description: "When Pro ends (or ended, for pro_expired). Null for free and for Pro that does not expire.",
	})
	proUntil!: string | null;

	@ApiProperty({ example: false, description: "Pro that does not expire (a stored Pro Plan or an open-ended grant)" })
	permanent!: boolean;
}

export class AdminProGrantDto {
	@ApiProperty({ enum: ENTITLEMENT_SOURCES, example: "billing" })
	source!: EntitlementSource;

	@ApiPropertyOptional({ nullable: true, description: "Null: does not expire" })
	expiresAt!: string | null;

	@ApiProperty({ example: true, description: "Counts toward Pro now" })
	active!: boolean;

	@ApiPropertyOptional({ nullable: true, description: "When an admin revoked it" })
	revokedAt!: string | null;

	@ApiProperty()
	createdAt!: string;

	@ApiProperty()
	updatedAt!: string;
}

export class AdminUserProDto extends AdminUserPlanDto {
	@ApiProperty({
		enum: USER_PLANS,
		example: "free",
		description: "The stored Plan; 'pro' is a permanent operator comp",
	})
	storedPlan!: UserPlan;

	@ApiProperty({ type: [AdminProGrantDto], description: "Every Pro Plan Entitlement the User holds or held" })
	grants!: AdminProGrantDto[];
}

export class AdminPaymentDto {
	@ApiProperty({ example: 12 })
	id!: number;

	@ApiProperty({ example: "stripe" })
	provider!: string;

	@ApiProperty({ example: "pro_year_pass" })
	offer!: string;

	@ApiPropertyOptional({ nullable: true, example: 2999, description: "Minor units, VAT-inclusive" })
	amountTotal!: number | null;

	@ApiPropertyOptional({ nullable: true, example: "eur" })
	currency!: string | null;

	@ApiProperty()
	paidAt!: string;

	@ApiPropertyOptional({ nullable: true, description: "The Pro expiry this payment produced" })
	passExpiresAt!: string | null;

	@ApiPropertyOptional({
		nullable: true,
		example: "https://dashboard.stripe.com/events/evt_123",
		description: "The payment's webhook event in the Stripe dashboard, built from the stored event id only",
	})
	dashboardUrl!: string | null;
}

export class AdminGenerationUsageDto {
	@ApiProperty({ example: 2, description: "Generation requests counted today (UTC), refused ones included" })
	used!: number;

	@ApiPropertyOptional({ nullable: true, example: 3, description: "Today's cap; null means no cap" })
	limit!: number | null;

	@ApiPropertyOptional({
		enum: GENERATION_QUOTA_TIERS,
		nullable: true,
		description: "The quota tier; null with billing off (one cap for everyone)",
	})
	tier!: GenerationQuotaTier | null;
}

export class AdminAuditEntryDto {
	@ApiProperty({ example: 7 })
	id!: number;

	@ApiProperty({ enum: ADMIN_AUDIT_ACTIONS, example: "pro.grant" })
	action!: AdminAuditAction;

	@ApiPropertyOptional({ nullable: true, example: 1 })
	actorId!: number | null;

	@ApiProperty({ example: "admin@example.com" })
	actorEmail!: string;

	@ApiProperty({ example: "Support: comp after outage" })
	reason!: string;

	@ApiProperty({ type: "object", additionalProperties: true, description: "The action's input and before/after state" })
	details!: Record<string, unknown>;

	@ApiProperty()
	createdAt!: string;
}

export class AdminUserBillingDto {
	@ApiProperty({ type: AdminUserProDto })
	pro!: AdminUserProDto;

	@ApiProperty({ type: [AdminPaymentDto], description: "Newest first" })
	payments!: AdminPaymentDto[];

	@ApiProperty({ type: SavedRoutesAllowanceDto })
	savedRoutes!: SavedRoutesAllowanceDto;

	@ApiProperty({ type: AdminGenerationUsageDto })
	generationToday!: AdminGenerationUsageDto;

	@ApiProperty({ type: [AdminAuditEntryDto], description: "Admin actions on this User, newest first" })
	auditLog!: AdminAuditEntryDto[];
}

export class AdminProReasonDto {
	@ApiProperty({ example: "Refunded in Stripe", description: "Why; kept in the audit log" })
	@IsString()
	@MinLength(3)
	@MaxLength(500)
	reason!: string;
}

export class AdminGrantProDto extends AdminProReasonDto {
	@ApiPropertyOptional({ example: 30, description: `Days of Pro from now, 1 to ${MAX_ADMIN_GRANT_DAYS}` })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(MAX_ADMIN_GRANT_DAYS)
	days?: number;

	@ApiPropertyOptional({ example: false, description: "Pro that does not expire (a comp); excludes `days`" })
	@IsOptional()
	@IsBoolean()
	permanent?: boolean;
}

export class AdminLimitHitPointDto {
	@ApiProperty({ example: "2026-10-13" })
	date!: string;

	@ApiProperty({ example: 4, description: "Free Users who hit the saved-Route cap that day" })
	savedRoutes!: number;

	@ApiProperty({ example: 9, description: "Free Users who hit the daily generation quota that day" })
	generationQuota!: number;
}

export class AdminLimitConversionDto {
	@ApiProperty({ example: 40, description: "Free Users who hit a limit in the window" })
	hitUsers!: number;

	@ApiProperty({ example: 6, description: "Of those, bought a Pro pass within 7 days of their first hit" })
	converted!: number;

	@ApiProperty({ example: 15, description: "converted / hitUsers, in percent" })
	conversionPct!: number;

	@ApiProperty({
		example: 5,
		description: "Hit users still inside their 7 days who have not bought yet; they can still convert",
	})
	pending!: number;
}

export class AdminLimitMetricsDto {
	@ApiProperty({ description: "False when Umami is not configured or could not be read" })
	productEventsAvailable!: boolean;

	@ApiProperty({ type: [AdminLimitHitPointDto] })
	daily!: AdminLimitHitPointDto[];

	@ApiPropertyOptional({ type: AdminLimitConversionDto, nullable: true })
	conversion!: AdminLimitConversionDto | null;
}

export class AdminRevenuePointDto {
	@ApiProperty({ example: "2026-10-13" })
	date!: string;

	@ApiProperty({ example: 5998, description: "Minor units, VAT-inclusive" })
	amount!: number;
}

export class AdminRevenueTotalDto {
	@ApiProperty({ example: "eur" })
	currency!: string;

	@ApiProperty({ example: 59980, description: "Minor units, VAT-inclusive" })
	amount!: number;

	@ApiProperty({ example: 20 })
	payments!: number;
}

export class AdminProEndingUserDto {
	@ApiProperty({ example: 42 })
	id!: number;

	@ApiProperty({ example: "user@example.com" })
	email!: string;

	@ApiProperty({ example: "Jane Doe" })
	name!: string;

	@ApiProperty({ enum: PLAN_KINDS })
	kind!: PlanKind;

	@ApiProperty()
	proUntil!: string;
}

export class AdminProEndingDto {
	@ApiProperty({ example: 12 })
	count!: number;

	@ApiProperty({ type: [AdminProEndingUserDto], description: "Soonest first, at most 50" })
	users!: AdminProEndingUserDto[];
}

export class AdminProUsersPointDto {
	@ApiProperty({ example: "2026-10-13" })
	date!: string;

	@ApiProperty({ example: 140 })
	count!: number;
}

export class AdminProMetricsDto {
	@ApiProperty({
		type: [AdminProUsersPointDto],
		description:
			"Approximate: Users on Pro at the end of each day (now, for today), reconstructed from the current Entitlement rows. Each row keeps only its latest grant, so a User granted Pro again after a lapse or revocation also counts on the days in between and past days can over-count.",
	})
	proUsersDaily!: AdminProUsersPointDto[];

	@ApiPropertyOptional({
		nullable: true,
		example: "eur",
		description: "The currency revenueDaily is in: the one most payments in the window used",
	})
	currency!: string | null;

	@ApiProperty({ type: [AdminRevenuePointDto] })
	revenueDaily!: AdminRevenuePointDto[];

	@ApiProperty({ type: [AdminRevenueTotalDto], description: "Revenue in the window per currency" })
	revenueTotals!: AdminRevenueTotalDto[];

	@ApiProperty({ type: AdminLimitMetricsDto })
	limits!: AdminLimitMetricsDto;

	@ApiProperty({ type: AdminProEndingDto, description: "Pro that ends in the next 30 days" })
	endingSoon!: AdminProEndingDto;
}
