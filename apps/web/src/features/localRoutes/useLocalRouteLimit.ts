import { FREE_SAVED_ROUTE_LIMIT } from "@routess/core";

import { useBillingStatus } from "@/lib/api-queries";

import { useLocalRoutes } from "./localRoutesStore";

// A device holds as many LocalRoutes as a free account holds Routes, so
// signing up never strands any (ADR 0039 applies on the device too). Only
// while billing is on, like the account cap.
export function useAtLocalRouteLimit(): boolean {
	const { routes } = useLocalRoutes();
	const billingEnabled = useBillingStatus().data?.enabled === true;
	return billingEnabled && routes.length >= FREE_SAVED_ROUTE_LIMIT;
}
