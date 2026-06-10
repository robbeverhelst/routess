import type { Coordinate } from "../types";

function squaredDistance(a: Coordinate, b: Coordinate): number {
	return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

// Joins loose line pieces into one continuous path by greedy nearest-endpoint
// chaining, reversing pieces as needed. For feeds without node ids (OSM
// relation members, Brussels ICR segments); gaps between disconnected pieces
// stay as short jumps. O(n^2) over piece count, fine for feed-sized inputs.
export function stitchLooseSegments(pieces: Coordinate[][]): Coordinate[] {
	const unused = pieces.filter((p) => p.length >= 2);
	if (unused.length === 0) return [];
	const path = [...(unused.shift() as Coordinate[])];
	while (unused.length > 0) {
		const tail = path[path.length - 1] as Coordinate;
		let best = 0;
		let bestDistance = Number.POSITIVE_INFINITY;
		let bestReversed = false;
		for (let i = 0; i < unused.length; i++) {
			const piece = unused[i] as Coordinate[];
			const head = piece[0] as Coordinate;
			const last = piece[piece.length - 1] as Coordinate;
			const headDistance = squaredDistance(tail, head);
			const lastDistance = squaredDistance(tail, last);
			if (headDistance < bestDistance) {
				bestDistance = headDistance;
				best = i;
				bestReversed = false;
			}
			if (lastDistance < bestDistance) {
				bestDistance = lastDistance;
				best = i;
				bestReversed = true;
			}
		}
		const piece = unused.splice(best, 1)[0] as Coordinate[];
		const coords = bestReversed ? [...piece].reverse() : piece;
		const joint = coords[0] as Coordinate;
		path.push(...(tail[0] === joint[0] && tail[1] === joint[1] ? coords.slice(1) : coords));
	}
	return path;
}

export interface PathJumpStats {
	lengthMeters: number;
	jumpMeters: number;
	maxJumpMeters: number;
}

const METERS_PER_DEGREE = 111_320;

// Quantifies stitching damage: consecutive gaps above `thresholdMeters` are
// artificial connectors (no underlying way), summed so adapters can refuse
// routes that stitched badly. Equirectangular approx is plenty at gap scale.
export function pathJumpStats(path: Coordinate[], thresholdMeters = 150): PathJumpStats {
	let lengthMeters = 0;
	let jumpMeters = 0;
	let maxJumpMeters = 0;
	for (let i = 0; i < path.length - 1; i++) {
		const a = path[i] as Coordinate;
		const b = path[i + 1] as Coordinate;
		const dx = (a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180) * METERS_PER_DEGREE;
		const dy = (a[1] - b[1]) * METERS_PER_DEGREE;
		const step = Math.hypot(dx, dy);
		lengthMeters += step;
		if (step > thresholdMeters) {
			jumpMeters += step;
			maxJumpMeters = Math.max(maxJumpMeters, step);
		}
	}
	return { lengthMeters, jumpMeters, maxJumpMeters };
}
