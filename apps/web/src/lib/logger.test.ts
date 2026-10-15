import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

// The log level is resolved once at module load, so each test needs a fresh
// copy of the module; a unique query string makes Bun evaluate it again.
let importCount = 0;
async function importLogger(): Promise<typeof import("./logger")> {
	importCount += 1;
	return await import(`./logger?fresh=${importCount}`);
}

describe("Logger", () => {
	beforeEach(() => {
		window.localStorage.clear();
		delete process.env.VITE_LOG_LEVEL;
		vi.spyOn(console, "debug").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		delete process.env.VITE_LOG_LEVEL;
		vi.restoreAllMocks();
	});

	it("uses the configured Vite log level", async () => {
		// Bun's import.meta.env is process.env.
		process.env.VITE_LOG_LEVEL = "warn";
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
