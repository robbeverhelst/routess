import type { ScoredCandidate } from "./types";

// Selection (ADR-0029): a tiered quality gate plus diversity dedupe. Mediocre
// candidates survive with a badge (rural reality); unusable ones are dropped;
// near-identical shapes are deduped so the picker never shows the same loop
// twice (the issue's "duplicate avoidance").

/** Overlap above this is unusable: structurally an out-and-back. */
export const OVERLAP_UNUSABLE_LIMIT = 0.5;

/** Overlap above this is shown, but with a "repeated roads" badge. */
export const OVERLAP_WARN_LIMIT = 0.15;

/** Way-set Jaccard similarity above which two candidates count as the same loop. */
export const CANDIDATE_SIMILARITY_LIMIT = 0.6;

export const MAX_SELECTED_CANDIDATES = 3;

export function isUsable(candidate: ScoredCandidate): boolean {
	return candidate.score.overlap <= OVERLAP_UNUSABLE_LIMIT;
}

export function isLowQuality(overlap: number): boolean {
	return overlap > OVERLAP_WARN_LIMIT;
}

function waySet(candidate: ScoredCandidate): Set<number> {
	const ways = new Set<number>();
	for (const edge of candidate.edges) {
		if (typeof edge.wayId === "number") ways.add(edge.wayId);
	}
	return ways;
}

export function candidateSimilarity(a: ScoredCandidate, b: ScoredCandidate): number {
	const waysA = waySet(a);
	const waysB = waySet(b);
	if (waysA.size === 0 || waysB.size === 0) return 0;
	let intersection = 0;
	for (const way of waysA) {
		if (waysB.has(way)) intersection++;
	}
	const union = waysA.size + waysB.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

/**
 * Greedy diverse selection: walk candidates by score, keep the best of each
 * shape family, stop at the cap. Input order does not matter.
 */
export function selectDiverseCandidates<T extends ScoredCandidate>(
	candidates: T[],
	maxCount: number = MAX_SELECTED_CANDIDATES,
	similarityLimit: number = CANDIDATE_SIMILARITY_LIMIT,
): T[] {
	const usable = candidates.filter(isUsable).sort((a, b) => b.score.total - a.score.total);
	const selected: T[] = [];
	for (const candidate of usable) {
		if (selected.length >= maxCount) break;
		const duplicate = selected.some((kept) => candidateSimilarity(kept, candidate) > similarityLimit);
		if (!duplicate) selected.push(candidate);
	}
	return selected;
}
