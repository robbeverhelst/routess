import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless unsubscribe token: `<userId>.<hmac>`. Never expires, because an
// unsubscribe link in an old mail must keep working. Domain-separated from
// every other use of the secret.
function mac(secret: string, userId: number): string {
	return createHmac("sha256", secret).update(`weekly-digest-unsubscribe:${userId}`).digest("base64url");
}

export function createUnsubscribeToken(secret: string, userId: number): string {
	return `${userId}.${mac(secret, userId)}`;
}

export function verifyUnsubscribeToken(secret: string, token: string): number | null {
	const match = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token);
	if (!match) return null;
	const userId = Number(match[1]);
	const expected = Buffer.from(mac(secret, userId));
	const given = Buffer.from(match[2]);
	return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
}
