import { buildMapboxStaticPreviewUrl, parseRouteSlugId } from "@routess/core";
import { fetchExternalRoute, fetchPublicRoute } from "@/lib/route-api";

async function resolvePreview(slugId: string): Promise<{ points: [number, number][]; isPublic: boolean } | null> {
	const parsed = parseRouteSlugId(slugId);
	if (!parsed) return null;
	if (parsed.externalId !== undefined) {
		// ExternalRoutes are always public (ADR 0035).
		const route = await fetchExternalRoute(parsed.externalId);
		if (!route || route.geometry.length === 0) return null;
		return { points: route.geometry, isPublic: true };
	}
	const route = await fetchPublicRoute(parsed.id ?? parsed.token);
	const points = route?.geometry?.length ? route.geometry : (route?.waypoints ?? []).map((w) => w.coord);
	if (!route || points.length === 0) return null;
	return { points, isPublic: route.visibility === "public" };
}

// First-party OG/preview image. Proxies the Mapbox Static API server-side with
// a Referer header: the pk token is URL-restricted and social scrapers send no
// Referer, so they cannot fetch Mapbox directly.
export async function GET(_request: Request, ctx: { params: Promise<{ slugId: string }> }) {
	const { slugId } = await ctx.params;
	const preview = await resolvePreview(slugId);
	if (!preview) return new Response("Not found", { status: 404 });
	const token = process.env.MAPBOX_PUBLIC_TOKEN;
	if (!token) return new Response("Map preview unavailable", { status: 503 });
	const url = buildMapboxStaticPreviewUrl(preview.points, { token, width: 1200, height: 630, padding: 40 });
	if (!url) return new Response("Not found", { status: 404 });
	const upstream = await fetch(url, { headers: { Referer: "https://routess.com/" } });
	if (!upstream.ok) return new Response("Map preview unavailable", { status: 502 });
	const body = await upstream.arrayBuffer();
	return new Response(body, {
		headers: {
			"Content-Type": upstream.headers.get("content-type") ?? "image/png",
			"Cache-Control": "public, max-age=3600, s-maxage=86400",
			...(preview.isPublic ? {} : { "X-Robots-Tag": "noindex" }),
		},
	});
}
