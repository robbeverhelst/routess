import type { Coordinate } from "@routess/core";
import { haversineDistance } from "@routess/core";
import type { ElevationProvider, ElevationResult, ProfilePoint } from "./types";

const DEFAULT_TARGET_SPACING_METERS = 50;
const DEFAULT_MAX_SAMPLES = 256;
const DEFAULT_SMOOTHING_WINDOW = 5;
// Treat tiny up/down jitter (≤ this many meters between consecutive smoothed
// samples) as noise rather than real climb. Contour-line snapping in the
// terrain tileset would otherwise inflate gain on flat sections.
const NOISE_THRESHOLD_METERS = 1.5;

export interface SampleAndComputeOptions {
	targetSpacingMeters?: number;
	maxSamples?: number;
	smoothingWindow?: number;
	signal?: AbortSignal;
}

interface DensifiedSample {
	coord: Coordinate;
	distanceMeters: number;
}

const densify = (path: Coordinate[], targetSpacingMeters: number, maxSamples: number): DensifiedSample[] => {
	if (path.length === 0) return [];
	if (path.length === 1) return [{ coord: path[0], distanceMeters: 0 }];

	const cumulative: number[] = [0];
	for (let i = 1; i < path.length; i++) {
		cumulative.push(cumulative[i - 1] + haversineDistance(path[i - 1], path[i]) * 1000);
	}
	const totalMeters = cumulative[cumulative.length - 1];
	if (totalMeters === 0) return [{ coord: path[0], distanceMeters: 0 }];

	// Compute spacing so we never exceed maxSamples.
	const desiredCount = Math.ceil(totalMeters / targetSpacingMeters) + 1;
	const count = Math.min(Math.max(2, desiredCount), maxSamples);
	const spacing = totalMeters / (count - 1);

	const samples: DensifiedSample[] = [];
	let segIdx = 0;
	for (let i = 0; i < count; i++) {
		const target = i === count - 1 ? totalMeters : i * spacing;
		while (segIdx < cumulative.length - 1 && cumulative[segIdx + 1] < target) segIdx++;
		const segStart = cumulative[segIdx];
		const segEnd = cumulative[segIdx + 1] ?? segStart;
		const segLen = segEnd - segStart;
		const t = segLen > 0 ? (target - segStart) / segLen : 0;
		const a = path[segIdx];
		const b = path[Math.min(segIdx + 1, path.length - 1)];
		const lon = a[0] + (b[0] - a[0]) * t;
		const lat = a[1] + (b[1] - a[1]) * t;
		samples.push({ coord: [lon, lat], distanceMeters: target });
	}
	return samples;
};

const interpolateNulls = (values: (number | null)[]): number[] => {
	const result = values.slice() as (number | null)[];

	// Forward fill from first known value.
	let firstKnown = -1;
	for (let i = 0; i < result.length; i++) {
		if (result[i] != null) {
			firstKnown = i;
			break;
		}
	}
	if (firstKnown === -1) return result.map(() => 0);
	for (let i = 0; i < firstKnown; i++) result[i] = result[firstKnown];

	// Linear interp across interior gaps; backfill trailing gap.
	let i = firstKnown;
	while (i < result.length) {
		if (result[i] != null) {
			i++;
			continue;
		}
		let j = i;
		while (j < result.length && result[j] == null) j++;
		if (j >= result.length) {
			const last = result[i - 1] as number;
			for (let k = i; k < result.length; k++) result[k] = last;
			break;
		}
		const start = result[i - 1] as number;
		const end = result[j] as number;
		const span = j - (i - 1);
		for (let k = i; k < j; k++) {
			result[k] = start + ((end - start) * (k - (i - 1))) / span;
		}
		i = j + 1;
	}
	return result as number[];
};

const smooth = (values: number[], window: number): number[] => {
	if (window <= 1 || values.length === 0) return values.slice();
	const half = Math.floor(window / 2);
	const out: number[] = new Array(values.length);
	for (let i = 0; i < values.length; i++) {
		const lo = Math.max(0, i - half);
		const hi = Math.min(values.length - 1, i + half);
		let sum = 0;
		for (let k = lo; k <= hi; k++) sum += values[k];
		out[i] = sum / (hi - lo + 1);
	}
	return out;
};

export const computeGainLoss = (elevations: number[]): { gainMeters: number; lossMeters: number } => {
	let gain = 0;
	let loss = 0;
	for (let i = 1; i < elevations.length; i++) {
		const delta = elevations[i] - elevations[i - 1];
		if (delta > NOISE_THRESHOLD_METERS) gain += delta;
		else if (delta < -NOISE_THRESHOLD_METERS) loss += -delta;
	}
	return { gainMeters: gain, lossMeters: loss };
};

export class ElevationService {
	private readonly provider: ElevationProvider;
	private readonly cache = new Map<string, ElevationResult>();
	private readonly maxCacheEntries = 32;

	constructor(provider: ElevationProvider) {
		this.provider = provider;
	}

	async sampleAndCompute(path: Coordinate[], options: SampleAndComputeOptions = {}): Promise<ElevationResult> {
		const targetSpacing = options.targetSpacingMeters ?? DEFAULT_TARGET_SPACING_METERS;
		const maxSamples = options.maxSamples ?? DEFAULT_MAX_SAMPLES;
		const window = options.smoothingWindow ?? DEFAULT_SMOOTHING_WINDOW;

		if (path.length < 2) return { gainMeters: 0, lossMeters: 0, profile: [] };

		const cacheKey = makeCacheKey(path, targetSpacing, maxSamples, window);
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

		const samples = densify(path, targetSpacing, maxSamples);
		const raw = await this.provider.sample(
			samples.map((s) => s.coord),
			options.signal,
		);
		const filled = interpolateNulls(raw);
		const smoothed = smooth(filled, window);
		const { gainMeters, lossMeters } = computeGainLoss(smoothed);

		const profile: ProfilePoint[] = samples.map((s, i) => ({
			distanceMeters: s.distanceMeters,
			elevationMeters: smoothed[i],
		}));

		const result: ElevationResult = { gainMeters, lossMeters, profile };
		this.put(cacheKey, result);
		return result;
	}

	private put(key: string, result: ElevationResult): void {
		if (this.cache.size >= this.maxCacheEntries) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) this.cache.delete(firstKey);
		}
		this.cache.set(key, result);
	}
}

const makeCacheKey = (path: Coordinate[], spacing: number, max: number, window: number): string => {
	// Hash by length + sparse-sampled vertices; full coordinate stringification
	// is fine at typical route sizes but quickly grows, so we sample.
	const stride = Math.max(1, Math.floor(path.length / 16));
	const parts: string[] = [`${path.length}|${spacing}|${max}|${window}`];
	for (let i = 0; i < path.length; i += stride) {
		const [lon, lat] = path[i];
		parts.push(`${lon.toFixed(5)},${lat.toFixed(5)}`);
	}
	return parts.join(";");
};
