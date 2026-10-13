import { ProductEventStatsService } from "../../../src/analytics/product-event-stats.service";
import type { AppConfig } from "../../../src/config/app-config";

function serviceWith(analytics: Partial<AppConfig["analytics"]>): ProductEventStatsService {
	return new ProductEventStatsService({
		analytics: {
			salt: "test-salt",
			umamiDatabaseUrl: "",
			umamiWebsiteId: "",
			umamiRetentionDays: 425,
			...analytics,
		},
	} as AppConfig);
}

describe("ProductEventStatsService", () => {
	it("is disabled until both the database URL and the website ID are configured", () => {
		expect(serviceWith({}).enabled).toBe(false);
		expect(serviceWith({ umamiDatabaseUrl: "postgres://x" }).enabled).toBe(false);
		expect(serviceWith({ umamiWebsiteId: "abc" }).enabled).toBe(false);
		expect(serviceWith({ umamiDatabaseUrl: "postgres://x", umamiWebsiteId: "abc" }).enabled).toBe(true);
	});

	it("returns null rather than throwing when unconfigured", async () => {
		await expect(serviceWith({}).dailyCounts(["route_generation_started"], 30)).resolves.toBeNull();
	});

	it("returns null rather than throwing when Umami is unreachable", async () => {
		const service = serviceWith({ umamiDatabaseUrl: "postgres://nobody@127.0.0.1:1/umami", umamiWebsiteId: "abc" });
		await expect(service.dailyCounts(["route_generation_started"], 30)).resolves.toBeNull();
	});
});
