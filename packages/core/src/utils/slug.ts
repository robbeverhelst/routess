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

// ExternalRoutes live in their own table with their own id sequence (ADR 0033),
// so their public page uses an `-x{id}` tail to stay unambiguous against a user
// Route's `-{id}`. The `x` is the only marker the resolver needs.
export function buildExternalRouteSlugId(name: string, externalId: number): string {
	return `${toRouteSlug(name)}-x${externalId}`;
}

const SHARE_TOKEN_SLUG_PATTERN = /^(.*?)-([0-9a-f]{32})$/;
const EXTERNAL_SLUG_PATTERN = /^(.*?)-x(\d+)$/;

export type ParsedRouteSlugId =
	| { slug: string; id: number; token?: undefined; externalId?: undefined }
	| { slug: string; token: string; id?: undefined; externalId?: undefined }
	| { slug: string; externalId: number; id?: undefined; token?: undefined };

export function parseRouteSlugId(slugId: string): ParsedRouteSlugId | null {
	// Token first: a 32-hex tail is unambiguous (real ids are far shorter).
	const tokenMatch = SHARE_TOKEN_SLUG_PATTERN.exec(slugId);
	if (tokenMatch?.[2]) {
		return { slug: tokenMatch[1] ?? "", token: tokenMatch[2] };
	}
	// External next: the `-x` discriminator must be tried before the plain
	// numeric form, otherwise `-x12` would only match the `\d+` tail as `12`.
	const externalMatch = EXTERNAL_SLUG_PATTERN.exec(slugId);
	if (externalMatch?.[2]) {
		const externalId = Number(externalMatch[2]);
		if (Number.isFinite(externalId) && externalId > 0) {
			return { slug: externalMatch[1] ?? "", externalId };
		}
	}
	const match = /^(.*?)-(\d+)$/.exec(slugId);
	if (!match) return null;
	const id = Number(match[2]);
	if (!Number.isFinite(id) || id <= 0) return null;
	return { slug: match[1] ?? "", id };
}
