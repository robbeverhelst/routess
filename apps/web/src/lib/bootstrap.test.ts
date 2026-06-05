import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBootstrap } from "@/lib/bootstrap";

vi.mock("@/lib/runtime-config", () => ({
	getRuntimeConfig: vi.fn(() => "1.2.0"),
}));

const { getProfile } = vi.hoisted(() => ({
	getProfile: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
	apiService: { getProfile },
}));

describe("runBootstrap", () => {
	beforeEach(() => {
		localStorage.clear();
		getProfile.mockReset();
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
		expect(getProfile).not.toHaveBeenCalled();
	});

	it("purges unversioned ad-hoc keys but keeps auth state when the build version changes", async () => {
		getProfile.mockResolvedValue({ id: "u1", email: "fresh@example.com" });
		localStorage.setItem("maps-app-version", JSON.stringify({ current: "1.1.0", lastChecked: Date.now() - 1000 }));
		localStorage.setItem("access_token", "tok");
		localStorage.setItem("user", '{"id":"u1"}');
		localStorage.setItem("lastKnownLocation", "[4.35,50.85]");
		localStorage.setItem("mapWaypoints", '{"waypoints":[]}');
		localStorage.setItem("routess.redesign.settings", "{}");
		localStorage.setItem("mapLastView", "{}");

		runBootstrap();

		expect(localStorage.getItem("access_token")).toBe("tok");
		expect(localStorage.getItem("lastKnownLocation")).toBeNull();
		expect(localStorage.getItem("mapWaypoints")).toBeNull();
		// Zustand-persisted stores keep their own versioning - leave them alone.
		expect(localStorage.getItem("routess.redesign.settings")).toBe("{}");
		// Validator-protected keys are also untouched.
		expect(localStorage.getItem("mapLastView")).toBe("{}");

		// The stored user is refreshed from the server instead of purged.
		await vi.waitFor(() => {
			expect(JSON.parse(localStorage.getItem("user") ?? "{}")).toEqual({ id: "u1", email: "fresh@example.com" });
		});
	});

	it("keeps the stored user when the profile refresh fails", async () => {
		getProfile.mockRejectedValue(new Error("network down"));
		localStorage.setItem("maps-app-version", JSON.stringify({ current: "1.1.0", lastChecked: Date.now() - 1000 }));
		localStorage.setItem("access_token", "tok");
		localStorage.setItem("user", '{"id":"u1"}');

		runBootstrap();

		await vi.waitFor(() => expect(getProfile).toHaveBeenCalled());
		expect(localStorage.getItem("access_token")).toBe("tok");
		expect(localStorage.getItem("user")).toBe('{"id":"u1"}');
	});

	it("does not refresh the profile when no user is stored", async () => {
		localStorage.setItem("maps-app-version", JSON.stringify({ current: "1.1.0", lastChecked: Date.now() - 1000 }));
		localStorage.setItem("lastKnownLocation", "[4.35,50.85]");

		runBootstrap();

		expect(localStorage.getItem("lastKnownLocation")).toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(getProfile).not.toHaveBeenCalled();
	});

	it("does nothing when the build version is unchanged", () => {
		localStorage.setItem("maps-app-version", JSON.stringify({ current: "1.2.0", lastChecked: Date.now() - 1000 }));
		localStorage.setItem("access_token", "tok");

		runBootstrap();

		expect(localStorage.getItem("access_token")).toBe("tok");
		expect(getProfile).not.toHaveBeenCalled();
	});
});
