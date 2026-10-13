import {
	LIMIT_EVENTS,
	limitConversion,
	limitHitSeries,
	paymentDashboardUrl,
} from "../../../src/admin/admin-pro.service";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("paymentDashboardUrl", () => {
	it("links a Stripe payment to its webhook event, in test mode for test checkouts", () => {
		expect(paymentDashboardUrl("stripe", "evt_1Abc", "cs_live_9")).toBe("https://dashboard.stripe.com/events/evt_1Abc");
		expect(paymentDashboardUrl("stripe", "evt_1Abc", "cs_test_9")).toBe(
			"https://dashboard.stripe.com/test/events/evt_1Abc",
		);
	});

	it("builds no link for another provider or an id that is not a Stripe event id", () => {
		expect(paymentDashboardUrl("other", "evt_1Abc", "cs_live_9")).toBeNull();
		expect(paymentDashboardUrl("stripe", "evt_1/../../account", "cs_live_9")).toBeNull();
		expect(paymentDashboardUrl("stripe", "pi_123", "cs_live_9")).toBeNull();
	});
});

describe("limitHitSeries", () => {
	const now = new Date("2026-10-13T15:00:00Z");
	const hit = (date: string, eventName: string, userIdHash: string) => ({
		date,
		eventName,
		userIdHash,
		firstAt: new Date(`${date}T10:00:00Z`),
	});

	it("counts distinct Users per day and limit, every day in the window filled", () => {
		const series = limitHitSeries(
			[
				hit("2026-10-13", LIMIT_EVENTS.savedRoutes, "a"),
				hit("2026-10-13", LIMIT_EVENTS.savedRoutes, "b"),
				hit("2026-10-13", LIMIT_EVENTS.generationQuota, "a"),
				hit("2026-10-11", LIMIT_EVENTS.generationQuota, "c"),
				// Outside the window, and an unrelated event: both dropped.
				hit("2026-10-01", LIMIT_EVENTS.savedRoutes, "d"),
				hit("2026-10-13", "route_created", "e"),
			],
			3,
			now,
		);
		expect(series).toEqual([
			{ date: "2026-10-11", savedRoutes: 0, generationQuota: 1 },
			{ date: "2026-10-12", savedRoutes: 0, generationQuota: 0 },
			{ date: "2026-10-13", savedRoutes: 2, generationQuota: 1 },
		]);
	});
});

describe("limitConversion", () => {
	const now = new Date("2026-10-13T12:00:00Z");
	const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY_MS);
	const hit = (userIdHash: string, daysAgo: number) => ({
		date: at(daysAgo).toISOString().slice(0, 10),
		eventName: LIMIT_EVENTS.savedRoutes,
		userIdHash,
		firstAt: at(daysAgo),
	});

	it("counts a purchase within 7 days of the first hit as a conversion", () => {
		const result = limitConversion(
			[
				// Bought 3 days after the first hit (a later hit does not move it).
				hit("converted", 20),
				hit("converted", 18),
				// Bought 8 days after: too late.
				hit("late", 20),
				// Bought before hitting the limit: not a conversion.
				hit("before", 10),
				// Hit 2 days ago, has not bought: still pending.
				hit("pending", 2),
			],
			[
				{ userIdHash: "converted", paidAt: at(17) },
				{ userIdHash: "late", paidAt: at(12) },
				{ userIdHash: "before", paidAt: at(11) },
				{ userIdHash: "never-hit", paidAt: at(1) },
			],
			now,
		);
		expect(result).toEqual({ hitUsers: 4, converted: 1, conversionPct: 25, pending: 1 });
	});

	it("reports zero, not NaN, when nobody hit a limit", () => {
		expect(limitConversion([], [], now)).toEqual({ hitUsers: 0, converted: 0, conversionPct: 0, pending: 0 });
	});
});
