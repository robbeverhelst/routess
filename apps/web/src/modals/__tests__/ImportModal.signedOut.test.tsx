import { beforeEach, describe, expect, it, vi } from "bun:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TooltipProvider } from "@/components/Tooltip";
import { createMemoryBackend, type LocalRouteBackend } from "@/features/localRoutes/localRouteDb";
import { setLocalRouteBackend, useLocalRoutesStore } from "@/features/localRoutes/localRoutesStore";
import { queryKeys } from "@/lib/query-client";

const trackEventMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({ trackEvent: trackEventMock }));
vi.mock("@/hooks/useAuthState", () => ({ useIsAuthenticated: () => false }));
// ProLock's Go Pro navigates; no router is mounted here.
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

import { ImportModal } from "../ImportModal";

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
	<metadata><name>Canal ride</name></metadata>
	<trk><trkseg>
		<trkpt lat="51.0543" lon="3.7174"></trkpt>
		<trkpt lat="51.0600" lon="3.7250"></trkpt>
		<trkpt lat="51.0643" lon="3.7274"></trkpt>
	</trkseg></trk>
</gpx>`;

describe("ImportModal signed out", () => {
	let backend: LocalRouteBackend;

	beforeEach(() => {
		trackEventMock.mockClear();
		backend = createMemoryBackend();
		setLocalRouteBackend(backend);
		useLocalRoutesStore.setState({ routes: [], hydrated: true, boundLocalId: null });
	});

	const renderModal = () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		client.setQueryData(queryKeys.billing.status(false), { enabled: false });
		return render(
			<QueryClientProvider client={client}>
				<TooltipProvider>
					<ImportModal />
				</TooltipProvider>
			</QueryClientProvider>,
		);
	};

	it("saves a GPX to the library as a route on this device, without an account", async () => {
		const { container } = renderModal();
		const input = container.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("file input missing");
		fireEvent.change(input, { target: { files: [new File([GPX], "canal.gpx", { type: "application/gpx+xml" })] } });

		fireEvent.click(screen.getByRole("button", { name: /Save to library/ }));
		expect(screen.getByText("Saved on this device. Sign in later and it moves into your account.")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /Import 1 route/ }));

		await waitFor(async () => expect(await backend.list()).toHaveLength(1));
		const [saved] = await backend.list();
		expect(saved.route).toMatchObject({ name: "Canal ride", visibility: "private", provenance: "gpx-import" });
		expect(saved.creationSource).toBe("imported");
		expect(trackEventMock.mock.calls.map(([event]) => event.name)).toEqual([
			"gpx_imported",
			"route_created",
			"local_route_saved",
		]);
	});
});
