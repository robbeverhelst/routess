const MAX_SLUG_LENGTH = 40;

export function toRouteSlug(name: string): string {
	const ascii = name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const slug = ascii.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
	return slug || "route";
}

// `ref` is a numeric route id (public routes: canonical, SEO-friendly) or a
// 32-hex share token (unlisted routes: unguessable, since sequential ids
// would make "only people with the link" enumerable).
export function buildRouteSlugId(name: string, ref: number | string): string {
	return `${toRouteSlug(name)}-${ref}`;
}

const SHARE_TOKEN_SLUG_PATTERN = /^(.*?)-([0-9a-f]{32})$/;

export type ParsedRouteSlugId =
	| { slug: string; id: number; token?: undefined }
	| { slug: string; token: string; id?: undefined };

export function parseRouteSlugId(slugId: string): ParsedRouteSlugId | null {
	// Token first: a 32-hex tail is unambiguous (real ids are far shorter).
	const tokenMatch = SHARE_TOKEN_SLUG_PATTERN.exec(slugId);
	if (tokenMatch?.[2]) {
		return { slug: tokenMatch[1] ?? "", token: tokenMatch[2] };
	}
	const match = /^(.*?)-(\d+)$/.exec(slugId);
	if (!match) return null;
	const id = Number(match[2]);
	if (!Number.isFinite(id) || id <= 0) return null;
	return { slug: match[1] ?? "", id };
}
