import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	Post,
	type RawBodyRequest,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser, OptionalCurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { ThrottleModerate, ThrottlePublic, ThrottleStrict } from "../common/decorators/throttle.decorator";
import { BillingService } from "./billing.service";
import { InvalidWebhookError } from "./billing-provider";
import { BillingStatusDto, CheckoutResponseDto, StartCheckoutDto, WebhookResponseDto } from "./dto/billing.dto";

// Pro year pass (ADR 0039). Browser-only: checkout needs a session cookie, so
// a PAT cannot spend money. Every route answers 503 (status: enabled false)
// while BILLING_ENABLED is off.
@ApiTags("billing")
@Controller("billing")
export class BillingController {
	constructor(private readonly billing: BillingService) {}

	@ApiOperation({
		summary: "Billing status",
		description:
			"Whether billing is on, the Pro pass offer and the daily generation allowance per tier; for a signed-in User also their Plan and Pro expiry. Reading it applies a pending OG grant.",
	})
	@ApiResponse({ status: 200, type: BillingStatusDto })
	@UseGuards(OptionalJwtAuthGuard)
	@ThrottleModerate()
	@Get()
	status(@OptionalCurrentUser() user: AuthenticatedUser | null): Promise<BillingStatusDto> {
		return this.billing.status(user?.id ?? null);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiOperation({
		summary: "Start a checkout",
		description: "Creates a Stripe Checkout Session for a Pro year pass and returns the URL to send the browser to.",
	})
	@ApiBody({ type: StartCheckoutDto })
	@ApiResponse({ status: 201, type: CheckoutResponseDto })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 403, description: "Account is pending deletion" })
	@ApiResponse({ status: 503, description: "Billing is not enabled on this instance" })
	@UseGuards(JwtAuthGuard)
	@ThrottleStrict()
	@Post("checkout")
	async checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartCheckoutDto): Promise<CheckoutResponseDto> {
		const session = await this.billing.startCheckout(user, dto.offer ?? "pro_year_pass");
		return { url: session.url };
	}

	@ApiOperation({
		summary: "Stripe webhook",
		description:
			"Called by Stripe, not by clients. Verifies the Stripe-Signature header over the raw body and grants the pass on checkout.session.completed. Redelivered events are acknowledged without granting twice.",
	})
	@ApiResponse({ status: 200, type: WebhookResponseDto })
	@ApiResponse({ status: 400, description: "Missing or invalid signature" })
	@ApiResponse({ status: 503, description: "Billing is not enabled on this instance" })
	@ThrottlePublic()
	@HttpCode(200)
	@Post("webhook")
	async webhook(@Req() request: RawBodyRequest<Request>): Promise<WebhookResponseDto> {
		try {
			// rawBody is kept by the JSON parser (rawBody: true in main.ts); an
			// empty one simply fails the signature check.
			const rawBody = request.rawBody ?? Buffer.alloc(0);
			await this.billing.handleWebhook({ rawBody, headers: request.headers });
		} catch (error) {
			if (error instanceof InvalidWebhookError) {
				throw new BadRequestException(error.message);
			}
			throw error;
		}
		return { received: true };
	}
}
