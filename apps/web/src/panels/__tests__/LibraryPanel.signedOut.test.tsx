import { beforeEach, describe, expect, it, vi } from "bun:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";

import { createMemoryBackend } from "@/features/localRoutes/localRouteDb";
import { setLocalRouteBackend, useLocalRoutesStore } from "@/features/localRoutes/localRoutesStore";

const trackEventMock = vi.fn();
const emitAppEventMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({ trackEvent: trackEventMock }));
vi.mock("@/hooks/useAuthState", () => ({ useIsAuthenticated: () => false }));
vi.mock("@/lib/app-events", () => ({ emitAppEvent: emitAppEventMock, onAppEvent: () => () => {} }));

import { LibraryPanel } from "../LibraryPanel";

// Saving works on the device, so an empty signed-out library is an
// invitation to plan, not a sign-in wall.
describe("LibraryPanel signed out with no routes on this device", () => {
	beforeEach(() => {
		trackEventMock.mockClear();
		emitAppEventMock.mockClear();
		setLocalRouteBackend(createMemoryBackend());
		useLocalRoutesStore.setState({ routes: [], hydrated: true, boundLocalId: null });
	});

	const renderPanel = () =>
		render(
			<QueryClientProvider client={new QueryClient()}>
				<LibraryPanel />
			</QueryClientProvider>,
		);

	it("offers planning instead of the auth wall", () => {
		renderPanel();

		expect(screen.getByRole("button", { name: /Plan a route/ })).toBeTruthy();
		expect(screen.queryByText("Sign in to see your library")).toBeNull();
		expect(trackEventMock).not.toHaveBeenCalledWith(expect.objectContaining({ name: "auth_wall_hit" }));
	});

	it("keeps a quiet way back to an existing account", () => {
		renderPanel();
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(emitAppEventMock).toHaveBeenCalledWith("routess:open-login", { entryPoint: "library_empty" });
	});
});
