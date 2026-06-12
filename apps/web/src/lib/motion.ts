// CSS animations collapse via the --rds-dur-* tokens; rAF-driven animations
// (map layers) must check this themselves.
export const prefersReducedMotion = (): boolean =>
	typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
