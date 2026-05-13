import * as Sentry from "@sentry/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });

if (Sentry.isInitialized()) {
	Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
}

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	return <RouterProvider router={router} />;
}

export default App;
