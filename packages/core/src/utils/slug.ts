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

export function buildRouteSlugId(name: string, id: number): string {
	return `${toRouteSlug(name)}-${id}`;
}

export function parseRouteSlugId(slugId: string): { slug: string; id: number } | null {
	const match = /^(.*?)-(\d+)$/.exec(slugId);
	if (!match) return null;
	const id = Number(match[2]);
	if (!Number.isFinite(id) || id <= 0) return null;
	return { slug: match[1] ?? "", id };
}
