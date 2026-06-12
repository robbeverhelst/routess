import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/Tooltip";
import { LocationService } from "@/services/LocationService";
import { useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
import { LoopModal } from "../LoopModal";

const renderModal = () =>
	render(
		<TooltipProvider>
			<LoopModal />
		</TooltipProvider>,
	);

// setup.ts installs vi.fn() stubs for navigator.geolocation; swap implementations.
function mockGeolocation(getCurrentPosition: typeof navigator.geolocation.getCurrentPosition) {
	vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(getCurrentPosition);
	vi.mocked(navigator.geolocation.watchPosition).mockImplementation(() => 1);
}

describe("LoopModal my-location", () => {
	beforeEach(() => {
		localStorage.clear();
		useLoopPreferencesStore.setState({ start: { kind: "center" }, end: { kind: "center" }, routeType: "loop" });
	});

	afterEach(() => {
		LocationService.destroyInstance();
		vi.restoreAllMocks();
	});

	it("does not lock the modal while geolocation is pending", () => {
		// Geolocation backend that never answers (e.g. OS prompt pending).
		mockGeolocation(vi.fn());
		LocationService.destroyInstance();

		renderModal();
		fireEvent.click(screen.getByRole("button", { name: /my location/i }));

		expect(screen.getByRole("button", { name: /map center/i })).toBeEnabled();
		expect(screen.getByRole("button", { name: /pick on map/i })).toBeEnabled();
		expect(screen.getByRole("button", { name: /^generate$/i })).toBeEnabled();
		for (const button of screen.getAllByRole("button")) {
			expect(getComputedStyle(button).cursor).not.toBe("wait");
		}
	});

	it("seeds the start point immediately from the last known location", () => {
		localStorage.setItem("lastKnownLocation", JSON.stringify([4.4025, 51.2194]));
		mockGeolocation(vi.fn());
		LocationService.destroyInstance();

		renderModal();
		fireEvent.click(screen.getByRole("button", { name: /my location/i }));

		expect(useLoopPreferencesStore.getState().start).toEqual({
			kind: "point",
			coord: [4.4025, 51.2194],
			source: "geolocation",
		});
	});

	it("updates the start point when a fresh fix arrives", async () => {
		localStorage.setItem("lastKnownLocation", JSON.stringify([4.4025, 51.2194]));
		mockGeolocation(
			vi.fn((success) => {
				setTimeout(
					() =>
						success({
							coords: { longitude: 4.5, latitude: 51.3, accuracy: 5, heading: null, speed: null },
							timestamp: Date.now(),
						} as GeolocationPosition),
					0,
				);
			}),
		);
		LocationService.destroyInstance();

		renderModal();
		fireEvent.click(screen.getByRole("button", { name: /my location/i }));

		await waitFor(() => {
			expect(useLoopPreferencesStore.getState().start).toEqual({
				kind: "point",
				coord: [4.5, 51.3],
				source: "geolocation",
			});
		});
	});
});
