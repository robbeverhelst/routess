import { useEffect, useRef } from "react";

// Easing time constant. Larger = smoother but laggier; ~120ms tracks turns
// closely while filtering out magnetometer jitter (the Google Maps feel).
const SMOOTHING_TAU_MS = 120;
// Stop the rAF loop once we're this close to the target to save battery.
const SETTLE_EPSILON_DEG = 0.1;
// Clamp dt after a backgrounded tab so we don't jump on the first frame back.
const MAX_FRAME_MS = 100;

// Shortest signed turn from `from` to `to`, handling the 360->0 wrap.
function shortestDelta(from: number, to: number): number {
	return ((to - from + 540) % 360) - 180;
}

/**
 * Eases a heading (degrees clockwise from north) toward `target`, emitting the
 * smoothed value to `onHeading` via requestAnimationFrame. Decouples the
 * displayed cone from the noisy sensor rate so it glides instead of snapping.
 * Driving the map imperatively here keeps React out of the 60Hz hot path; a
 * null target clears the cone. The loop self-stops once settled.
 */
export function useSmoothedHeading(target: number | null, onHeading: (heading: number | null) => void): void {
	const onHeadingRef = useRef(onHeading);
	onHeadingRef.current = onHeading;

	const targetRef = useRef<number | null>(target);
	const currentRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastTsRef = useRef<number | null>(null);

	useEffect(() => {
		targetRef.current = target;

		// No target: clear the cone and stop animating.
		if (target == null) {
			if (rafRef.current != null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			lastTsRef.current = null;
			if (currentRef.current != null) {
				currentRef.current = null;
				onHeadingRef.current(null);
			}
			return;
		}

		// First reading: snap rather than sweep from an arbitrary angle.
		if (currentRef.current == null) {
			currentRef.current = target;
			onHeadingRef.current(target);
			return;
		}

		// A loop is already easing toward the (now updated) target.
		if (rafRef.current != null) return;

		const tick = (ts: number) => {
			rafRef.current = null;
			const t = targetRef.current;
			const current = currentRef.current;
			if (t == null || current == null) {
				lastTsRef.current = null;
				return;
			}
			const dt = lastTsRef.current == null ? 16 : Math.min(ts - lastTsRef.current, MAX_FRAME_MS);
			lastTsRef.current = ts;

			const delta = shortestDelta(current, t);
			if (Math.abs(delta) < SETTLE_EPSILON_DEG) {
				currentRef.current = t;
				onHeadingRef.current(t);
				lastTsRef.current = null;
				return; // settled
			}
			const alpha = 1 - Math.exp(-dt / SMOOTHING_TAU_MS);
			currentRef.current = (((current + delta * alpha) % 360) + 360) % 360;
			onHeadingRef.current(currentRef.current);
			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);
	}, [target]);

	useEffect(() => {
		return () => {
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
		};
	}, []);
}
