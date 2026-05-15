import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { DomainException } from "../../common/exceptions/domain.exception";
import type { AuthenticatedUser } from "../authenticated-user";
import { CONFIRMATION_CHECK_KEY, type ConfirmationCheck } from "../decorators/require-confirmation.decorator";

export const CONFIRMATION_HEADER = "x-routess-confirm";

// Enforces ADR-0023's X-Routess-Confirm gate on destructive PAT operations.
// Apply downstream of the auth guard so req.user is populated. Cookie
// sessions bypass the gate (the web UI expresses confirmation through its
// own dialogs). PAT-authenticated requests against a handler decorated
// with @RequireConfirmation must carry `X-Routess-Confirm: true` when the
// check function decides the operation is destructive.
@Injectable()
export class ConfirmationGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
		if (request.user?.authMethod !== "pat") {
			return true;
		}

		const check = this.reflector.getAllAndOverride<ConfirmationCheck | undefined>(CONFIRMATION_CHECK_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (!check) {
			return true;
		}

		const impact = check(request);
		if (!impact) {
			return true;
		}

		const confirm = request.headers[CONFIRMATION_HEADER];
		if (typeof confirm === "string" && confirm.toLowerCase() === "true") {
			return true;
		}

		throw new DomainException(
			HttpStatus.PRECONDITION_REQUIRED,
			"PRECONDITION_REQUIRED",
			"This operation requires explicit confirmation. Set the X-Routess-Confirm: true header on the retry.",
			{ impact, header: "X-Routess-Confirm" },
		);
	}
}
