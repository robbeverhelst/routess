import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createQuotaSafeStorage } from "./routing";

// A localStorage with a byte budget: setItem throws QuotaExceededError for
// any value longer than the budget, like a full origin would.
function stubLocalStorage(budgetChars: number) {
	const data = new Map<string, string>();
	const stub = {
		getItem: (name: string) => data.get(name) ?? null,
		setItem: (name: string, value: string) => {
			if (value.length > budgetChars) {
				throw new DOMException("quota", "QuotaExceededError");
			}
			data.set(name, value);
		},
		removeItem: (name: string) => {
			data.delete(name);
		},
	};
	Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true });
	return data;
}

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

// A persisted snapshot whose bulk sits in the undo history, like a real
// long-edited draft: the route itself is far smaller than its edit history.
function bigSnapshot() {
	const waypoints = Array.from({ length: 10 }, (_, i) => ({ coord: [4 + i * 0.01, 51], type: "routed" }));
	const routePath = Array.from({ length: 300 }, (_, i) => [4 + i * 0.001, 51 + i * 0.0001]);
	const history = {
		past: Array.from({ length: 50 }, () => waypoints),
		future: [],
	};
	return {
		state: {
			waypoints,
			routePath,
			elevationProfile: Array.from({ length: 256 }, (_, i) => ({ distanceM: i * 80, elevationM: 10 })),
			distanceMeters: 21000,
			durationSeconds: 15000,
			hasRoute: true,
			history,
			canUndo: true,
			canRedo: false,
		},
		version: 4,
	};
}

describe("createQuotaSafeStorage", () => {
	const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

	beforeEach(() => {
		// each test installs its own stub
	});

	afterEach(() => {
		if (originalDescriptor) Object.defineProperty(globalThis, "localStorage", originalDescriptor);
		else Reflect.deleteProperty(globalThis, "localStorage");
	});

	it("stores untrimmed when the payload fits", () => {
		const data = stubLocalStorage(10_000_000);
		const storage = createQuotaSafeStorage(silentLogger as never);
		const payload = JSON.stringify(bigSnapshot());
		storage.setItem("routing-store", payload);
		expect(data.get("routing-store")).toBe(payload);
	});

	it("sheds the undo history first and keeps the RoutePath", () => {
		const snapshot = bigSnapshot();
		const full = JSON.stringify(snapshot);
		const withoutHistory = JSON.stringify({
			...snapshot,
			state: { ...snapshot.state, history: { past: [], future: [] }, canUndo: false, canRedo: false },
		});
		// Budget admits the snapshot only once the history is gone.
		const data = stubLocalStorage(withoutHistory.length + 10);
		expect(full.length).toBeGreaterThan(withoutHistory.length + 10);

		const storage = createQuotaSafeStorage(silentLogger as never);
		storage.setItem("routing-store", full);

		const stored = JSON.parse(data.get("routing-store") ?? "{}") as { state: Record<string, unknown> };
		expect((stored.state.history as { past: unknown[] }).past).toEqual([]);
		expect(stored.state.canUndo).toBe(false);
		// The route itself survives: the next refresh still shows the line.
		expect((stored.state.routePath as unknown[]).length).toBe(300);
		expect((stored.state.waypoints as unknown[]).length).toBe(10);
	});

	it("sheds the RoutePath only as a last resort, keeping waypoints and metrics", () => {
		const snapshot = bigSnapshot();
		// Budget so tight that history AND profile AND path must all go.
		const minimal = JSON.stringify({
			...snapshot,
			state: {
				...snapshot.state,
				history: { past: [], future: [] },
				canUndo: false,
				canRedo: false,
				elevationProfile: undefined,
				routePath: [],
			},
		});
		const data = stubLocalStorage(minimal.length + 10);

		const storage = createQuotaSafeStorage(silentLogger as never);
		storage.setItem("routing-store", JSON.stringify(snapshot));

		const stored = JSON.parse(data.get("routing-store") ?? "{}") as { state: Record<string, unknown> };
		expect((stored.state.routePath as unknown[]).length).toBe(0);
		expect(stored.state.elevationProfile).toBeUndefined();
		// The self-heal inputs survive: waypoints + hasRoute drive the boot recompute.
		expect((stored.state.waypoints as unknown[]).length).toBe(10);
		expect(stored.state.hasRoute).toBe(true);
		expect(stored.state.distanceMeters).toBe(21000);
	});
});
