const DAY_MS = 24 * 60 * 60 * 1000;

// How long a Plan grant runs: a Pro pass is { days: 365 }, the OG grant
// { months: 3 } (ADR 0039).
export type GrantLength = { days: number } | { months: number };

// The new end of a time-boxed grant. Buying again extends: the length is added
// to whichever is later, `from` (the payment or grant moment) or the end of
// the time the User already holds, so no paid day is lost.
export function extendExpiry(current: Date | null, from: Date, length: GrantLength): Date {
	const base = current && current.getTime() > from.getTime() ? current : from;
	return addLength(base, length);
}

function addLength(base: Date, length: GrantLength): Date {
	if ("days" in length) {
		return new Date(base.getTime() + length.days * DAY_MS);
	}
	// Calendar months in UTC, clamped to the target month's last day so that
	// 30 November + 3 months is 28 (or 29) February, not early March.
	const next = new Date(base.getTime());
	const day = next.getUTCDate();
	next.setUTCDate(1);
	next.setUTCMonth(next.getUTCMonth() + length.months);
	const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
	next.setUTCDate(Math.min(day, lastDay));
	return next;
}
