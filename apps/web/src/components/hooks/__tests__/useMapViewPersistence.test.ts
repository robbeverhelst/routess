import { act, renderHook } from "@testing-library/react";
import type { Map as MapboxMap } from "mapbox-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMapViewPersistence } from "../useMapViewPersistence";

type MoveEndHandler = () => void;

function createMockMap() {
	const handlers: Record<string, MoveEndHandler[]> = {};
	return {
		on: vi.fn((event: string, handler: MoveEndHandler) => {
			handlers[event] = handlers[event] ?? [];
			handlers[event].push(handler);
		}),
		off: vi.fn(),
		getCenter: vi.fn(() => ({ lng: 4.4, lat: 51.2 })),
		getZoom: vi.fn(() => 13),
		getBearing: vi.fn(() => 0),
		getPitch: vi.fn(() => 0),
		fireMoveEnd: () => {
			for (const handler of handlers.moveend ?? []) handler();
		},
	};
}

describe("useMapViewPersistence", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("saves the map view on moveend when the map is ready at mount", () => {
		const mockMap = createMockMap();
		const mapRef = { current: mockMap as unknown as MapboxMap };

		renderHook(() => useMapViewPersistence(mapRef, true));

		act(() => {
			mockMap.fireMoveEnd();
		});

		expect(JSON.parse(localStorage.getItem("mapLastView") ?? "null")).toEqual({
			longitude: 4.4,
			latitude: 51.2,
			zoom: 13,
			bearing: 0,
			pitch: 0,
		});
	});

	it("saves the map view when the map loads after mount (real first-load order)", () => {
		const mockMap = createMockMap();
		const mapRef = { current: null as MapboxMap | null };

		// Hook mounts while the map is still loading (mapRef.current is null);
		// onLoad assigns the map and flips isMapReady afterwards, as in MapCanvas.
		const { rerender } = renderHook(({ ready }) => useMapViewPersistence(mapRef, ready), {
			initialProps: { ready: false },
		});
		mapRef.current = mockMap as unknown as MapboxMap;
		rerender({ ready: true });

		act(() => {
			mockMap.fireMoveEnd();
		});

		expect(JSON.parse(localStorage.getItem("mapLastView") ?? "null")).toEqual({
			longitude: 4.4,
			latitude: 51.2,
			zoom: 13,
			bearing: 0,
			pitch: 0,
		});
	});
});
