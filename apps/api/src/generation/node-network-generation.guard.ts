import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import type { AuthenticatedUser } from "../auth/authenticated-user";
import { EntitlementsService } from "../entitlements/entitlements.service";

// Knooppunt generation (preferNodeNetworks) is Pro (ADR 0039). Runs before
// GenerationQuotaGuard so a refused request does not spend the daily quota.
@Injectable()
export class NodeNetworkGenerationGuard implements CanActivate {
	constructor(private readonly entitlements: EntitlementsService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<Request & { user?: AuthenticatedUser | null; body?: { preferNodeNetworks?: unknown } }>();
		if (!request.body?.preferNodeNetworks) return true;
		const user = request.user?.id ? { id: request.user.id } : null;
		await this.entitlements.assertCan(user, "node_network_generation");
		return true;
	}
}
