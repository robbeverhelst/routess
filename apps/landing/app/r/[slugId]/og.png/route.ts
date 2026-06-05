import { buildMapboxStaticPreviewUrl, parseRouteSlugId } from "@routess/core";
import { fetchPublicRoute } from "@/lib/route-api";

// First-party OG/preview image. Proxies the Mapbox Static API server-side with
// a Referer header: the pk token is URL-restricted and social scrapers send no
// Referer, so they cannot fetch Mapbox directly.
export async function GET(_request: Request, ctx: { params: Promise<{ slugId: string }> }) {
	const { slugId } = await ctx.params;
	const parsed = parseRouteSlugId(slugId);
	if (!parsed) return new Response("Not found", { status: 404 });
	const route = await fetchPublicRoute(parsed.id);
	const points = route?.geometry?.length ? route.geometry : (route?.waypoints ?? []).map((w) => w.coord);
	if (!route || points.length === 0) return new Response("Not found", { status: 404 });
	const token = process.env.MAPBOX_PUBLIC_TOKEN;
	if (!token) return new Response("Map preview unavailable", { status: 503 });
	const url = buildMapboxStaticPreviewUrl(points, { token, width: 1200, height: 630, padding: 40 });
	if (!url) return new Response("Not found", { status: 404 });
	const upstream = await fetch(url, { headers: { Referer: "https://routess.com/" } });
	if (!upstream.ok) return new Response("Map preview unavailable", { status: 502 });
	const body = await upstream.arrayBuffer();
	return new Response(body, {
		headers: {
			"Content-Type": upstream.headers.get("content-type") ?? "image/png",
			"Cache-Control": "public, max-age=3600, s-maxage=86400",
			...(route.visibility !== "public" ? { "X-Robots-Tag": "noindex" } : {}),
		},
	});
}
