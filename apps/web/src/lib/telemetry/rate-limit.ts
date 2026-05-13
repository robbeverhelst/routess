import type { ErrorEvent, EventHint } from "@sentry/react";

const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_MESSAGE = 10;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function fingerprint(event: ErrorEvent, hint?: EventHint): string {
	const message = event.message ?? "";
	const exception = event.exception?.values?.[0];
	const type = exception?.type ?? "";
	const value = exception?.value ?? "";
	const originalMessage = hint?.originalException instanceof Error ? hint.originalException.message : "";
	return `${type}:${value || message || originalMessage}`;
}

export function rateLimitBeforeSend(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
	const key = fingerprint(event, hint);
	const now = Date.now();
	const bucket = buckets.get(key);

	if (!bucket || bucket.resetAt < now) {
		buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
		return event;
	}

	bucket.count += 1;
	if (bucket.count > MAX_EVENTS_PER_MESSAGE) {
		return null;
	}
	return event;
}

export function __resetRateLimit(): void {
	buckets.clear();
}
