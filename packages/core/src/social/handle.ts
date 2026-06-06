// Handle: the unique, URL-safe public address of a Profile (see CONTEXT.md
// "Handle"). 3-30 chars, lowercase alphanumeric plus hyphen, starts with a
// letter or digit. Never derived from email (emails are PII, Handles are
// public).

export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{2,29}$/;

// Max length for a generated base slug, leaving room for a dedupe suffix.
export const HANDLE_BASE_MAX_LENGTH = 24;

// Path segments and product words that can never be claimed as a Handle.
// Keep in sync with the backfill list in the social migration.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
	"admin",
	"api",
	"app",
	"assets",
	"auth",
	"blog",
	"collection",
	"collections",
	"compare",
	"cycling-routes",
	"discover",
	"docs",
	"feed",
	"fietsroutes",
	"guides",
	"hardlooproutes",
	"help",
	"inbox",
	"library",
	"login",
	"logout",
	"looproutes",
	"mail",
	"me",
	"plan",
	"privacy",
	"profile",
	"profiles",
	"r",
	"route",
	"routes",
	"routess",
	"running-routes",
	"search",
	"settings",
	"share",
	"shares",
	"signup",
	"sitemap",
	"social",
	"static",
	"support",
	"terms",
	"u",
	"user",
	"users",
	"walking-routes",
	"wandelroutes",
	"www",
]);

export function isValidHandle(value: unknown): value is string {
	return typeof value === "string" && HANDLE_PATTERN.test(value) && !RESERVED_HANDLES.has(value);
}

// Slugify a display name into a Handle base. Returns null when the name
// yields nothing usable (too short, reserved) so callers fall back to a
// random `user-<random>` handle instead.
export function handleBaseFromName(name: string): string | null {
	const base = name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, HANDLE_BASE_MAX_LENGTH)
		.replace(/-+$/, "");
	if (base.length < 3 || RESERVED_HANDLES.has(base)) return null;
	return base;
}
