import { beforeEach, describe, expect, it, vi } from "bun:test";

import { emptyHistory, type Waypoint } from "@routess/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Map as MapboxMap } from "mapbox-gl";

import { TooltipProvider } from "@/components/Tooltip";
import { createMemoryBackend, type LocalRoute, type LocalRouteBackend } from "@/features/localRoutes/localRouteDb";
import { setLocalRouteBackend, useLocalRoutesStore } from "@/features/localRoutes/localRoutesStore";
import { queryKeys } from "@/lib/query-client";

const fetchMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/hooks/useAuthState", () => ({ useIsAuthenticated: () => false }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/routing/services/elevation", () => ({
	getDefaultElevationService: () => ({
		sampleAndCompute: async () => ({ gainMeters: 0, lossMeters: 0, profile: [] }),
	}),
}));

import { createRouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { useRoutingStore } from "@/stores/routingStore";

import { SaveModal } from "../SaveModal";

const PATH: [number, number][] = [
	[3.7174, 51.0543],
	[3.725, 51.06],
	[3.7274, 51.0643],
];

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
	<trk><trkseg>
		${PATH.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"></trkpt>`).join("\n")}
	</trkseg></trk>
</gpx>`;

const editor = () =>
	createRouteDraftEditor({ map: { getSource: () => undefined } as unknown as MapboxMap, accessToken: "pk.test" });

describe("SaveModal signed out keeps the draft's Provenance", () => {
	let backend: LocalRouteBackend;

	beforeEach(() => {
		backend = createMemoryBackend();
		setLocalRouteBackend(backend);
		useLocalRoutesStore.setState({ routes: [], hydrated: true, boundLocalId: null, loadedAtUndoDepth: 0 });
		useRoutingStore.setState({
			waypoints: [],
			routePath: [],
			mode: { kind: "unsaved" },
			creationSource: "manual",
			forkedFromExternalRouteId: null,
			provenance: null,
			history: emptyHistory<Waypoint[]>(),
			canUndo: false,
			canRedo: false,
		});
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
		fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: "Ok", tracepoints: [null, null] }) });
	});

	const renderModal = () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		client.setQueryData(queryKeys.billing.status(false), { enabled: false });
		return render(
			<QueryClientProvider client={client}>
				<TooltipProvider>
					<SaveModal />
				</TooltipProvider>
			</QueryClientProvider>,
		);
	};

	const save = (name?: string) => {
		renderModal();
		if (name) fireEvent.change(screen.getByPlaceholderText("Schelde loop, long"), { target: { value: name } });
		fireEvent.click(screen.getByRole("button", { name: /Save route/ }));
	};

	it("saves a draft loaded from a GPX file as gpx-import", async () => {
		expect((await editor().loadFromGpx(GPX)).success).toBe(true);

		save("Canal ride");

		await waitFor(async () => expect(await backend.list()).toHaveLength(1));
		const [saved] = await backend.list();
		expect(saved.route.provenance).toBe("gpx-import");
	});

	it("keeps gpx-import when a LocalRoute from ImportModal is reopened and saved again", async () => {
		const imported: LocalRoute = {
			localId: "local-1",
			route: {
				name: "Canal ride",
				visibility: "private",
				waypoints: [
					{ coord: PATH[0], type: "routed" },
					{ coord: PATH[2], type: "routed" },
				],
				geometry: PATH,
				distance: 1400,
				provenance: "gpx-import",
			},
			creationSource: "imported",
			createdAt: "2026-11-26T00:00:00.000Z",
			updatedAt: "2026-11-26T00:00:00.000Z",
		};
		await backend.put(imported);
		useLocalRoutesStore.setState({ routes: [imported] });
		expect((await editor().loadFromLocalRoute(imported)).success).toBe(true);
		useLocalRoutesStore.getState().bind(imported.localId);

		save();

		await waitFor(async () => {
			const [saved] = await backend.list();
			expect(saved.updatedAt).not.toBe(imported.updatedAt);
		});
		const routes = await backend.list();
		expect(routes).toHaveLength(1);
		expect(routes[0].route.provenance).toBe("gpx-import");
	});
});
