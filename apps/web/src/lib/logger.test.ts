import { beforeEach, describe, expect, it, vi } from "vitest";

async function importLogger() {
	vi.resetModules();
	return await import("./logger");
}

describe("Logger", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.unstubAllEnvs();
		vi.spyOn(console, "debug").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("uses the configured Vite log level", async () => {
		vi.stubEnv("VITE_LOG_LEVEL", "warn");
		const { Logger } = await importLogger();

		Logger.info("hidden");
		Logger.warn("visible");

		expect(console.info).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalledWith("[Routess]", "visible");
	});

	it("lets local debugging opt into lower levels", async () => {
		const { Logger } = await importLogger();

		Logger.debug("hidden");
		Logger.setLevel("debug");
		Logger.debug("visible");

		expect(console.debug).toHaveBeenCalledTimes(1);
		expect(console.debug).toHaveBeenCalledWith("[Routess]", "visible");
		expect(window.localStorage.getItem("routess:log-level")).toBe("debug");
	});
});
