import type { ApiBillingStatus } from "@routess/api-client";
import type { ProGatedFeature } from "@routess/core";
import { hasStoredUser } from "@/lib/auth-state";
import { queryClient, queryKeys } from "@/lib/query-client";

// Whether the billing status locks a Pro Feature for this account (ADR 0039).
// Unknown status (still loading) and instances without billing lock nothing;
// the API enforces every gate either way.
export function featureLockedIn(status: ApiBillingStatus | undefined, feature: ProGatedFeature): boolean {
	if (!status?.enabled) return false;
	return !status.account?.features.includes(feature);
}

// Outside React (request builders): the same answer from the cached status.
export function isFeatureLocked(feature: ProGatedFeature): boolean {
	return featureLockedIn(queryClient.getQueryData(queryKeys.billing.status(hasStoredUser())), feature);
}
