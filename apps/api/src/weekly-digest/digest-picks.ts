import type { PublicRouteSummaryDto } from "../routes/dto/public-route-summary.dto";

export const DIGEST_ROUTE_COUNT = 3;
export const DIGEST_RADIUS_KM = 25;
// Keeps the "already sent" list bounded; ten weeks of picks.
export const DIGEST_SENT_HISTORY = 30;

export interface AreaBox {
	minLat: number;
	maxLat: number;
	minLng: number;
	maxLng: number;
}

// Square search box around the centre of the User's last planned Route.
export function searchBoxAround(area: AreaBox, radiusKm = DIGEST_RADIUS_KM): string {
	const lat = (area.minLat + area.maxLat) / 2;
	const lng = (area.minLng + area.maxLng) / 2;
	const dLat = radiusKm / 111;
	const dLng = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));
	const clamp = (n: number, limit: number) => Math.round(Math.min(Math.max(n, -limit), limit) * 1e5) / 1e5;
	return [clamp(lng - dLng, 180), clamp(lat - dLat, 90), clamp(lng + dLng, 180), clamp(lat + dLat, 90)].join(",");
}

// Newest-first Discover candidates, minus the User's own Routes and anything
// mailed before.
export function pickDigestRoutes(
	candidates: PublicRouteSummaryDto[],
	userId: number,
	alreadySent: readonly string[],
): PublicRouteSummaryDto[] {
	const sent = new Set(alreadySent);
	const picks: PublicRouteSummaryDto[] = [];
	for (const item of candidates) {
		if (!item.slugId || sent.has(item.slugId)) continue;
		if (item.user?.id === userId) continue;
		sent.add(item.slugId);
		picks.push(item);
		if (picks.length === DIGEST_ROUTE_COUNT) break;
	}
	return picks;
}

export function nextSentHistory(previous: readonly string[], picks: PublicRouteSummaryDto[]): string[] {
	const added = picks.flatMap((p) => (p.slugId ? [p.slugId] : []));
	return [...previous, ...added].slice(-DIGEST_SENT_HISTORY);
}
