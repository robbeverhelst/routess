import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import {
	advanceNavigation,
	applyRejoin,
	createNavigationContext,
	endNavigationSession,
	forceRejoin,
	type NavigationContext,
	remainingMeters,
	startNavigationSession,
} from "./engine";
import type { NavCue, NavigationEffect, NavigationSessionState, PositionFix } from "./types";

// Straight west→east path at lat 51; 0.001° lng ≈ 70 m.
const LAT = 51;
const STEP_METERS = 111195 * Math.cos((LAT * Math.PI) / 180) * 0.001;

function straightPath(points: number): Coordinate[] {
	return Array.from({ length: points }, (_, i) => [4 + i * 0.001, LAT] as Coordinate);
}

/** A coordinate `meters` along the straight path, `offsetMeters` to the north. */
function at(meters: number, offsetMeters = 0): Coordinate {
	return [4 + (meters / STEP_METERS) * 0.001, LAT + offsetMeters / 111195];
}

function fix(meters: number, offsetMeters = 0, timestampMs = 0, speedMps = 5): PositionFix {
	return { coord: at(meters, offsetMeters), timestampMs, speedMps };
}

function cue(distanceAlongMeters: number, text = "turn"): NavCue {
	return { kind: "maneuver", shapeIndex: 0, distanceAlongMeters, text };
}

function makeCtx(cues: NavCue[] = [], points = 100): NavigationContext {
	return createNavigationContext(straightPath(points), cues);
}

function effectTypes(effects: NavigationEffect[]): string[] {
	return effects.map((e) => e.type);
}

describe("cue announcement", () => {
	it("announces prepare, then now, exactly once each", () => {
		const ctx = makeCtx([cue(1000)]);
		let state = startNavigationSession();

		// Far away: nothing.
		let result = advanceNavigation(ctx, state, fix(200, 0, 0));
		expect(result.effects).toEqual([]);
		state = result.state;

		// Within prepare range (speed 5 m/s * 30 s = 150 m).
		result = advanceNavigation(ctx, state, fix(870, 0, 1000));
		expect(result.effects).toEqual([{ type: "announceCue", cueIndex: 0, stage: "prepare" }]);
		state = result.state;

		// Still in prepare range: no repeat.
		result = advanceNavigation(ctx, state, fix(880, 0, 2000));
		expect(result.effects).toEqual([]);
		state = result.state;

		// Within now range (clamped to minNowMeters 40).
		result = advanceNavigation(ctx, state, fix(965, 0, 3000));
		expect(result.effects).toEqual([{ type: "announceCue", cueIndex: 0, stage: "now" }]);
		state = result.state;

		result = advanceNavigation(ctx, state, fix(975, 0, 4000));
		expect(result.effects).toEqual([]);
	});

	it("skips past cues without announcing them", () => {
		const ctx = makeCtx([cue(100), cue(200), cue(3000)]);
		let state = startNavigationSession();
		// First fix already 1 km in: both early cues are passed, not announced.
		const result = advanceNavigation(ctx, state, fix(1000, 0, 0));
		expect(result.effects).toEqual([]);
		state = result.state;
		expect(state.nextCueIndex).toBe(2);
	});
});

describe("off-route detection", () => {
	it("ignores brief excursions within the dwell time", () => {
		const ctx = makeCtx();
		let state = startNavigationSession();
		state = advanceNavigation(ctx, state, fix(500, 0, 0)).state;

		// 80 m off the path, but only for 5 s.
		let result = advanceNavigation(ctx, state, fix(500, 80, 1000));
		expect(result.effects).toEqual([]);
		expect(result.state.status).toBe("following");
		state = result.state;

		result = advanceNavigation(ctx, state, fix(500, 80, 6000));
		expect(result.state.status).toBe("following");

		// Back on route before the dwell elapses: counter resets.
		state = advanceNavigation(ctx, state, fix(520, 0, 8000)).state;
		expect(state.offRouteSinceMs).toBeNull();
		expect(state.status).toBe("following");
	});

	it("does not trigger within the 50 m corridor", () => {
		const ctx = makeCtx();
		let state = startNavigationSession();
		state = advanceNavigation(ctx, state, fix(500, 0, 0)).state;
		const result = advanceNavigation(ctx, state, fix(510, 45, 60_000));
		expect(result.state.offRouteSinceMs).toBeNull();
		expect(result.state.status).toBe("following");
	});

	it("requests a rejoin ahead after sustained off-route", () => {
		const ctx = makeCtx();
		let state = startNavigationSession();
		state = advanceNavigation(ctx, state, fix(500, 0, 0)).state;

		state = advanceNavigation(ctx, state, fix(500, 100, 1000)).state;
		const result = advanceNavigation(ctx, state, fix(500, 120, 12_000));
		expect(effectTypes(result.effects)).toEqual(["offRoute", "requestRejoin"]);
		expect(result.state.status).toBe("offRoute");

		const rejoin = result.effects.find((e) => e.type === "requestRejoin");
		if (rejoin?.type !== "requestRejoin") throw new Error("expected requestRejoin");
		// Target is ahead of the last on-route position, never behind.
		expect(rejoin.targetDistanceAlongMeters).toBeCloseTo(500 + 150, -1);
	});

	it("recovers without a rejoin when the rider finds their own way back", () => {
		const ctx = makeCtx();
		let state = startNavigationSession();
		state = advanceNavigation(ctx, state, fix(500, 0, 0)).state;
		state = advanceNavigation(ctx, state, fix(500, 100, 1000)).state;
		state = advanceNavigation(ctx, state, fix(500, 120, 12_000)).state;
		expect(state.status).toBe("offRoute");

		const result = advanceNavigation(ctx, state, fix(600, 0, 20_000));
		expect(effectTypes(result.effects)).toContain("backOnRoute");
		expect(result.state.status).toBe("following");
		expect(result.state.distanceAlongMeters).toBeCloseTo(600, -1);
	});
});

describe("rejoin lifecycle", () => {
	function intoOffRoute(ctx: NavigationContext): NavigationSessionState {
		let state = startNavigationSession();
		state = advanceNavigation(ctx, state, fix(500, 0, 0)).state;
		state = advanceNavigation(ctx, state, fix(500, 200, 1000)).state;
		state = advanceNavigation(ctx, state, fix(500, 200, 12_000)).state;
		expect(state.status).toBe("offRoute");
		return state;
	}

	it("follows the connector, then lands back on the main path", () => {
		const ctx = makeCtx();
		let state = intoOffRoute(ctx);

		// Connector: from the off-route position straight back to 650 m along.
		const connector: Coordinate[] = [at(500, 200), at(575, 100), at(650, 0)];
		state = applyRejoin(state, connector, 650);
		expect(state.status).toBe("rejoining");

		// Mid-connector: still rejoining.
		let result = advanceNavigation(ctx, state, fix(575, 100, 13_000));
		expect(result.state.status).toBe("rejoining");
		state = result.state;

		// Connector end is on the main path.
		result = advanceNavigation(ctx, state, fix(650, 0, 14_000));
		expect(effectTypes(result.effects)).toContain("backOnRoute");
		expect(result.state.status).toBe("following");
		expect(result.state.distanceAlongMeters).toBeCloseTo(650, -1);
	});

	it("re-requests a rejoin when the rider strays from the connector", () => {
		const ctx = makeCtx();
		let state = intoOffRoute(ctx);
		state = applyRejoin(state, [at(500, 200), at(575, 100), at(650, 0)], 650);

		// 200 m east of the connector, sustained past the dwell.
		state = advanceNavigation(ctx, state, fix(800, 300, 13_000)).state;
		expect(state.status).toBe("rejoining");
		const result = advanceNavigation(ctx, state, fix(800, 300, 24_000));
		expect(effectTypes(result.effects)).toEqual(["requestRejoin"]);
		expect(result.state.status).toBe("offRoute");
		expect(result.state.rejoin).toBeNull();
	});

	it("counts the connector in the remaining distance", () => {
		const ctx = makeCtx();
		let state = intoOffRoute(ctx);
		const total = ctx.main.totalMeters;
		state = applyRejoin(state, [at(500, 200), at(575, 100), at(650, 0)], 650);
		const remaining = remainingMeters(ctx, state, fix(500, 200, 13_000));
		// Connector (~290 m) plus the main path after the rejoin target.
		expect(remaining).toBeGreaterThan(total - 650);
		expect(remaining).toBeLessThan(total - 650 + 400);
	});

	it("force rejoin skips the dwell", () => {
		const ctx = makeCtx();
		let state = startNavigationSession();
		state = advanceNavigation(ctx, state, fix(500, 0, 0)).state;
		const result = forceRejoin(ctx, state, fix(500, 10, 1000));
		expect(effectTypes(result.effects)).toEqual(["requestRejoin"]);
		expect(result.state.status).toBe("offRoute");
	});
});

describe("arrival", () => {
	it("does not arrive at the start of a loop even though start equals end", () => {
		const out = straightPath(100);
		const loop = [...out, ...[...out].reverse().slice(1)];
		const ctx = createNavigationContext(loop, []);
		const state = startNavigationSession();
		// Standing at the shared start/end point with zero progress.
		const result = advanceNavigation(ctx, state, fix(0, 0, 0));
		expect(result.state.status).toBe("following");
		expect(result.effects).toEqual([]);
	});

	it("arrives near the end once progress passes the gate", () => {
		const ctx = makeCtx([], 100);
		const total = ctx.main.totalMeters;
		let state = startNavigationSession();
		// Ride almost the whole route, then reach the end.
		state = advanceNavigation(ctx, state, fix(total * 0.6, 0, 0)).state;
		state = advanceNavigation(ctx, state, fix(total * 0.97, 0, 1000)).state;
		expect(state.status).toBe("following");
		const result = advanceNavigation(ctx, state, fix(total - 5, 0, 2000));
		expect(effectTypes(result.effects)).toContain("arrived");
		expect(result.state.status).toBe("ended");
		expect(result.state.arrived).toBe(true);
	});

	it("manual end is not an arrival", () => {
		const state = endNavigationSession(startNavigationSession());
		expect(state.status).toBe("ended");
		expect(state.arrived).toBe(false);
	});

	it("ended sessions ignore further fixes", () => {
		const ctx = makeCtx();
		const state = endNavigationSession(startNavigationSession());
		const result = advanceNavigation(ctx, state, fix(100, 0, 99_000));
		expect(result.state).toBe(state);
		expect(result.effects).toEqual([]);
	});
});
