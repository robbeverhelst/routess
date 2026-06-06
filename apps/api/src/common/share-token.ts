import { randomBytes } from "node:crypto";

// Unguessable handle for share links: 128 random bits as 32 hex chars.
// Hex (not base64url) so the token never contains "-" and survives the
// web's `/r/:slug-:ref` parsing, which splits on the last dash.
const SHARE_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function generateShareToken(): string {
	return randomBytes(16).toString("hex");
}

export function isShareToken(value: string): boolean {
	return SHARE_TOKEN_PATTERN.test(value);
}
