import { extendExpiry } from "../../../src/entitlements/grant-length";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_AT = new Date("2026-11-15T10:00:00Z");

describe("extendExpiry", () => {
	it("runs a first pass 365 days from payment", () => {
		expect(extendExpiry(null, PAID_AT, { days: 365 })).toEqual(new Date(PAID_AT.getTime() + 365 * DAY_MS));
	});

	it("ignores an end that already passed, so a lapsed User starts from payment", () => {
		const lapsed = new Date(PAID_AT.getTime() - 10 * DAY_MS);
		expect(extendExpiry(lapsed, PAID_AT, { days: 365 })).toEqual(new Date(PAID_AT.getTime() + 365 * DAY_MS));
	});

	it("extends from the current expiry when buying again early, losing no paid day", () => {
		const current = new Date(PAID_AT.getTime() + 100 * DAY_MS);
		expect(extendExpiry(current, PAID_AT, { days: 365 })).toEqual(new Date(current.getTime() + 365 * DAY_MS));
	});

	it("stacks two passes bought back to back to 730 days", () => {
		const first = extendExpiry(null, PAID_AT, { days: 365 });
		expect(extendExpiry(first, PAID_AT, { days: 365 })).toEqual(new Date(PAID_AT.getTime() + 730 * DAY_MS));
	});

	it("adds calendar months for the OG grant, clamping to the month's last day", () => {
		expect(extendExpiry(null, new Date("2026-11-15T10:00:00Z"), { months: 3 })).toEqual(
			new Date("2027-02-15T10:00:00Z"),
		);
		expect(extendExpiry(null, new Date("2026-11-30T08:30:00Z"), { months: 3 })).toEqual(
			new Date("2027-02-28T08:30:00Z"),
		);
		expect(extendExpiry(null, new Date("2027-11-30T08:30:00Z"), { months: 3 })).toEqual(
			new Date("2028-02-29T08:30:00Z"),
		);
	});
});
