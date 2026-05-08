import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBootstrap } from "@/lib/bootstrap";

vi.mock("@/lib/runtime-config", () => ({
	getRuntimeConfig: vi.fn(() => "1.2.0"),
}));

describe("runBootstrap", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("leaves ad-hoc keys alone on the very first boot", () => {
		localStorage.setItem("access_token", "tok");
		localStorage.setItem("user", '{"id":"u1"}');
		localStorage.setItem("lastKnownLocation", "[4.35,50.85]");
		localStorage.setItem("mapWaypoints", '{"waypoints":[]}');

		runBootstrap();

		expect(localStorage.getItem("access_token")).toBe("tok");
		expect(localStorage.getItem("user")).toBe('{"id":"u1"}');
		expect(localStorage.getItem("lastKnownLocation")).toBe("[4.35,50.85]");
		expect(localStorage.getItem("mapWaypoints")).toBe('{"waypoints":[]}');
	});

	it("purges unversioned ad-hoc keys when the build version changes", () => {
		localStorage.setItem("maps-app-version", JSON.stringify({ current: "1.1.0", lastChecked: Date.now() - 1000 }));
		localStorage.setItem("access_token", "tok");
		localStorage.setItem("user", '{"id":"u1"}');
		localStorage.setItem("lastKnownLocation", "[4.35,50.85]");
		localStorage.setItem("mapWaypoints", '{"waypoints":[]}');
		localStorage.setItem("routess.redesign.settings", "{}");
		localStorage.setItem("mapLastView", "{}");

		runBootstrap();

		expect(localStorage.getItem("access_token")).toBeNull();
		expect(localStorage.getItem("user")).toBeNull();
		expect(localStorage.getItem("lastKnownLocation")).toBeNull();
		expect(localStorage.getItem("mapWaypoints")).toBeNull();
		// Zustand-persisted stores keep their own versioning - leave them alone.
		expect(localStorage.getItem("routess.redesign.settings")).toBe("{}");
		// Validator-protected keys are also untouched.
		expect(localStorage.getItem("mapLastView")).toBe("{}");
	});

	it("does nothing when the build version is unchanged", () => {
		localStorage.setItem("maps-app-version", JSON.stringify({ current: "1.2.0", lastChecked: Date.now() - 1000 }));
		localStorage.setItem("access_token", "tok");

		runBootstrap();

		expect(localStorage.getItem("access_token")).toBe("tok");
	});
});
