import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { runBootstrap } from "./lib/bootstrap.ts";
import { initPwa } from "./lib/pwa.ts";
import { initTelemetry } from "./lib/telemetry";

initTelemetry();
runBootstrap();
initPwa();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
