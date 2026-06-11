import type { Coordinate } from "../types";
import { haversineDistance } from "../utils/geospatial";
import { loopRadiusKm } from "./fan";
import type { CandidatePlan, GenerationAnchor } from "./types";

// The anchors stage (ADR-0029, reserved in v1; ADR-0037 for the knooppunt
// pool). Pool anchors attract nearby candidate vias; must-pass anchors are
// injected as extra vias into every candidate. Anchors are hints: the snapped
// plans still go through /locate validation and scoring like any other.

/** Hard cap on the anchor pool a single generation considers. */
export const MAX_POOL_ANCHORS = 1000;

/** Must-pass anchors per request; each one adds a via to every candidate. */
export const MAX_REQUIRED_ANCHORS = 8;

/**
 * How far a via may move onto a pool anchor: half the loop radius, like the
 * /locate snap allowance, bounded so tiny loops still reach the nearest Node
 * and huge loops don't teleport vias across the map.
 */
export function anchorSnapRadiusKm(targetDistanceKm: number): number {
	return Math.min(5, Math.max(0.5, loopRadiusKm(targetDistanceKm) / 2));
}

/**
 * Snap each via to the nearest pool anchor within `maxRadiusKm`. Each anchor
 * captures at most one via (the closest), so two vias never collapse onto the
 * same Node. Vias with no anchor in range stay geometric.
 */
export function snapViasToAnchors(plan: CandidatePlan, pool: GenerationAnchor[], maxRadiusKm: number): CandidatePlan {
	if (pool.length === 0 || plan.viaPoints.length === 0) return plan;

	const candidates = plan.viaPoints
		.flatMap((via, viaIndex) =>
			pool.map((anchor, anchorIndex) => ({
				viaIndex,
				anchorIndex,
				km: haversineDistance(via, anchor.coordinate),
			})),
		)
		.filter((pair) => pair.km <= maxRadiusKm)
		.sort((a, b) => a.km - b.km);

	const viaTaken = new Set<number>();
	const anchorTaken = new Set<number>();
	const assignment = new Map<number, GenerationAnchor>();
	for (const pair of candidates) {
		if (viaTaken.has(pair.viaIndex) || anchorTaken.has(pair.anchorIndex)) continue;
		viaTaken.add(pair.viaIndex);
		anchorTaken.add(pair.anchorIndex);
		assignment.set(pair.viaIndex, pool[pair.anchorIndex]);
	}
	if (assignment.size === 0) return plan;

	return {
		...plan,
		viaPoints: plan.viaPoints.map((via, i) => assignment.get(i)?.coordinate ?? via),
		viaAnchors: plan.viaPoints.map((_, i) => assignment.get(i)),
	};
}

/**
 * Inject must-pass anchors as extra vias, each at the position in the loop
 * (start → vias… → start) that adds the least crow-flies detour, so the
 * router is not forced into a zigzag the scoring would only punish later.
 */
export function injectRequiredAnchors(
	plan: CandidatePlan,
	required: GenerationAnchor[],
	start: Coordinate,
): CandidatePlan {
	if (required.length === 0) return plan;

	let viaPoints = [...plan.viaPoints];
	let viaAnchors: (GenerationAnchor | undefined)[] = plan.viaAnchors
		? [...plan.viaAnchors]
		: plan.viaPoints.map(() => undefined);

	for (const anchor of required) {
		const cycle = [start, ...viaPoints, start];
		let bestIndex = 0;
		let bestDetour = Infinity;
		for (let i = 0; i < cycle.length - 1; i++) {
			const detour =
				haversineDistance(cycle[i], anchor.coordinate) +
				haversineDistance(anchor.coordinate, cycle[i + 1]) -
				haversineDistance(cycle[i], cycle[i + 1]);
			if (detour < bestDetour) {
				bestDetour = detour;
				bestIndex = i;
			}
		}
		viaPoints = [...viaPoints.slice(0, bestIndex), anchor.coordinate, ...viaPoints.slice(bestIndex)];
		viaAnchors = [...viaAnchors.slice(0, bestIndex), anchor, ...viaAnchors.slice(bestIndex)];
	}

	return { ...plan, viaPoints, viaAnchors };
}

/**
 * Fraction of a plan's vias that sit on a Node anchor. The walk/run
 * NetworkFit signal (Valhalla has no foot-network edge attribute).
 */
export function anchoredViaFraction(plan: CandidatePlan): number {
	if (plan.viaPoints.length === 0) return 0;
	const anchored = (plan.viaAnchors ?? []).filter((a) => a?.ref !== undefined).length;
	return anchored / plan.viaPoints.length;
}
