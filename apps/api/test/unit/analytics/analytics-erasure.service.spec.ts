import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AnalyticsErasureService } from "../../../src/analytics/analytics-erasure.service";
import type { AppConfig } from "../../../src/config/app-config";

const REPO_ROOT = join(import.meta.dir, "../../../../..");

function serviceWith(analytics: Partial<AppConfig["analytics"]>): AnalyticsErasureService {
	return new AnalyticsErasureService({
		analytics: {
			salt: "test-salt",
			umamiDatabaseUrl: "",
			umamiWebsiteId: "",
			umamiRetentionDays: 425,
			...analytics,
		},
	} as AppConfig);
}

describe("AnalyticsErasureService", () => {
	it("is disabled until both the database URL and the website ID are configured", () => {
		expect(serviceWith({}).enabled).toBe(false);
		expect(serviceWith({ umamiDatabaseUrl: "postgres://x" }).enabled).toBe(false);
		expect(serviceWith({ umamiWebsiteId: "abc" }).enabled).toBe(false);
		expect(serviceWith({ umamiDatabaseUrl: "postgres://x", umamiWebsiteId: "abc" }).enabled).toBe(true);
	});

	it("no-ops rather than throwing when erasure is unconfigured", async () => {
		await expect(serviceWith({}).eraseUserEvents(1)).resolves.toBeNull();
	});

	it("no-ops rather than throwing when the retention sweep is unconfigured", async () => {
		await expect(serviceWith({}).enforceRetention()).resolves.toBeNull();
	});

	// The privacy policy states a 14-month window for ProductEvents. If the
	// default drifts from the published figure, the policy silently becomes a
	// false statement, which is worse than having no policy at all.
	it("defaults to the retention window the published privacy policy claims", () => {
		expect(serviceWith({}).retentionDays).toBe(425);

		const policy = readFileSync(join(REPO_ROOT, "apps/landing/lib/legal/privacy.ts"), "utf8");
		expect(policy).toContain("14 months");
		expect(policy).toContain("14 maanden");
	});
});
