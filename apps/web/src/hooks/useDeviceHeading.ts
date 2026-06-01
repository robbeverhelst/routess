import { useEffect, useRef, useState } from "react";

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

// Smallest heading change (degrees) worth a re-render. deviceorientation fires
// ~60Hz; this keeps the cone smooth without thrashing React/the map source.
const HEADING_EPSILON_DEG = 1.5;

function angularDelta(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

/**
 * Compass heading (degrees clockwise from true north) from the device's
 * magnetometer, or null when unavailable. On Android Chrome the
 * `deviceorientationabsolute` event delivers this with no permission prompt;
 * iOS exposes `webkitCompassHeading` but needs a permission gesture (not
 * wired here yet). Unlike GPS `coords.heading`, this works while stationary.
 */
export function useDeviceHeading(): number | null {
	const [heading, setHeading] = useState<number | null>(null);
	const lastRef = useRef<number | null>(null);

	useEffect(() => {
		const onOrientation = (event: Event) => {
			const e = event as CompassEvent;
			let next: number | null = null;
			if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
				// iOS: already a compass heading (clockwise from north).
				next = e.webkitCompassHeading;
			} else if (e.absolute && typeof e.alpha === "number") {
				// Android absolute orientation: convert alpha to a compass heading.
				next = (360 - e.alpha) % 360;
			}
			if (next == null || Number.isNaN(next)) return;
			next = ((next % 360) + 360) % 360;
			if (lastRef.current != null && angularDelta(lastRef.current, next) < HEADING_EPSILON_DEG) return;
			lastRef.current = next;
			setHeading(next);
		};

		// Prefer the absolute (true-north) stream on Android; fall back to the
		// generic event for browsers that only emit that one.
		window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
		window.addEventListener("deviceorientation", onOrientation as EventListener);
		return () => {
			window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
			window.removeEventListener("deviceorientation", onOrientation as EventListener);
		};
	}, []);

	return heading;
}
