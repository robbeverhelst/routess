import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoutingStore } from "@/stores/routingStore";

vi.mock("@/features/routing/managers/MapLayerManager", () => ({
	ROUTE_HOVER_LAYER_ID: "route-hover",
	ROUTE_LAYER_ID: "route",
	ROUTE_SOURCE_ID: "route-source",
	TEMP_DRAG_LINES_LAYER_ID: "drag-lines",
	WAYPOINTS_LAYER_ID: "points",
	animateWaypointSpawn: vi.fn(),
	setLiftedWaypoint: vi.fn(),
	updateDragLinesLayer: vi.fn(),
}));

import { initializeMapInteractions, type PopupInfo } from "./MapInteractionManager";

type Handler = (event?: unknown) => unknown;

function createFakeMap(canvas: HTMLCanvasElement) {
	const handlers = new Map<string, Handler>();
	return {
		handlers,
		map: {
			getCanvas: () => canvas,
			on: (type: string, layerOrHandler: string | Handler, maybeHandler?: Handler) => {
				if (typeof layerOrHandler === "function") handlers.set(type, layerOrHandler);
				else if (maybeHandler) handlers.set(`${type}:${layerOrHandler}`, maybeHandler);
			},
			off: () => {},
			queryRenderedFeatures: () => [],
			getSource: () => undefined,
			project: () => ({ x: 0, y: 0 }),
			setFeatureState: () => {},
			removeFeatureState: () => {},
			dragPan: { enable: () => {}, disable: () => {}, isActive: () => false },
			touchZoomRotate: { enable: () => {}, disable: () => {} },
		},
	};
}

describe("MapInteractionManager popup interactions", () => {
	let canvas: HTMLCanvasElement;
	let setPopup: ReturnType<typeof vi.fn>;
	let popupRef: { current: PopupInfo | null };
	let handlers: Map<string, Handler>;
	let dispose: () => void;

	const editor = {} as never;

	beforeEach(() => {
		useRoutingStore.setState({ waypoints: [] });
		canvas = document.createElement("canvas");
		setPopup = vi.fn();
		popupRef = {
			current: { longitude: 4.4, latitude: 51.2, type: "remove", waypointIndex: 0 },
		};
		const fake = createFakeMap(canvas);
		handlers = fake.handlers;
		dispose = initializeMapInteractions(fake.map as never, editor, setPopup as never, { current: false }, popupRef);
		setPopup.mockClear();
	});

	const tap = (target: EventTarget) => {
		handlers.get("touchstart")?.({
			points: [{ x: 10, y: 10 }],
			lngLat: { lng: 4.4, lat: 51.2 },
			originalEvent: { target },
		});
		handlers.get("touchend")?.();
	};

	it("does not dismiss the popup when the tap lands on the popup itself", () => {
		// Regression: the popup Marker lives inside Mapbox's canvas container,
		// so taps on its delete button bubble into the map's touch handlers
		// and used to dismiss the popup before the button's click could fire.
		const button = document.createElement("button");
		tap(button);

		expect(setPopup).not.toHaveBeenCalled();
		dispose();
	});

	it("still dismisses the popup when the tap lands on the map canvas", () => {
		tap(canvas);

		expect(setPopup).toHaveBeenCalledWith(null);
		dispose();
	});

	it("ignores clicks originating on the popup", async () => {
		await handlers.get("click")?.({
			point: { x: 10, y: 10 },
			lngLat: { lng: 4.4, lat: 51.2 },
			originalEvent: { target: document.createElement("button") },
			defaultPrevented: false,
		});

		expect(setPopup).not.toHaveBeenCalled();
		dispose();
	});
});
