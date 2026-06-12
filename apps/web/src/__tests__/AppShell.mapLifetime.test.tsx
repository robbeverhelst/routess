import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { vi } from "vitest";

// The map must mount exactly once for the lifetime of the shell: viewport
// breakpoint crossings (phone rotation, window resize) and full-screen
// views (user settings, profile) must never tear it down. Each remount
// flashes the loading spinner and rebuilds the whole routing editor.
const mapLifecycle = { mounts: 0, unmounts: 0 };

vi.mock("@/components/MapWithRouting", () => ({
	default: function MapWithRoutingStub() {
		useEffect(() => {
			mapLifecycle.mounts++;
			return () => {
				mapLifecycle.unmounts++;
			};
		}, []);
		return <div data-testid="map-stub" />;
	},
}));

vi.mock("@/panels/PlanPanel", () => ({ PlanPanel: () => <div /> }));
vi.mock("@/panels/LibraryPanel", () => ({ LibraryPanel: () => <div /> }));
vi.mock("@/panels/DiscoverPanel", () => ({ DiscoverPanel: () => <div /> }));
vi.mock("@/panels/SocialPanel", () => ({ SocialPanel: () => <div /> }));
vi.mock("@/panels/SettingsPanel", () => ({ SettingsPanel: () => <div /> }));
vi.mock("@/screens/UserSettingsScreen", () => ({
	UserSettingsScreen: () => <div data-testid="user-settings-screen" />,
}));

import { AppShell } from "@/AppShell";
import { TooltipProvider } from "@/components/Tooltip";

function setViewportWidth(width: number) {
	Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
	window.dispatchEvent(new Event("resize"));
}

async function flushViewport() {
	// useViewport defers state updates behind requestAnimationFrame
	await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
}

describe("AppShell map lifetime", () => {
	beforeEach(() => {
		mapLifecycle.mounts = 0;
		mapLifecycle.unmounts = 0;
		localStorage.setItem("routess.skippedAuth", "1");
		setViewportWidth(1280);
	});

	afterEach(() => {
		localStorage.clear();
	});

	function renderShell() {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, enabled: false } },
		});
		return render(
			<QueryClientProvider client={client}>
				<TooltipProvider>
					<AppShell />
				</TooltipProvider>
			</QueryClientProvider>,
		);
	}

	it("keeps the map mounted across mobile/desktop breakpoint crossings", async () => {
		renderShell();
		expect(mapLifecycle.mounts).toBe(1);

		// desktop -> mobile (phone portrait)
		setViewportWidth(390);
		await flushViewport();
		expect(mapLifecycle.unmounts).toBe(0);

		// portrait -> landscape (crosses the 768px breakpoint again)
		setViewportWidth(844);
		await flushViewport();
		expect(mapLifecycle.unmounts).toBe(0);

		// back to desktop
		setViewportWidth(1280);
		await flushViewport();
		expect(mapLifecycle.unmounts).toBe(0);
		expect(mapLifecycle.mounts).toBe(1);
	});

	it("keeps the map mounted while a full-screen view (user settings) is open", async () => {
		const { getByTestId } = renderShell();
		expect(mapLifecycle.mounts).toBe(1);

		act(() => {
			window.dispatchEvent(new CustomEvent("routess:open-user-settings"));
		});
		await waitFor(() => expect(getByTestId("user-settings-screen")).toBeInTheDocument());

		expect(mapLifecycle.unmounts).toBe(0);
		expect(mapLifecycle.mounts).toBe(1);
	});
});
