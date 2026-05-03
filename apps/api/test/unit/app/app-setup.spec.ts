import type { INestApplication } from "@nestjs/common";
import { configureApplication } from "../../../src/app/app-setup";
import { getAppConfig } from "../../../src/config/app-config";

describe("configureApplication", () => {
	function createMockApp(): jest.Mocked<Pick<INestApplication, "use" | "enableVersioning" | "useGlobalFilters" | "useGlobalPipes" | "enableCors">> {
		return {
			use: jest.fn(),
			enableVersioning: jest.fn(),
			useGlobalFilters: jest.fn(),
			useGlobalPipes: jest.fn(),
			enableCors: jest.fn(),
		};
	}

	it("allows configured frontend origins and requests without an origin header", () => {
		const app = createMockApp();
		const baseConfig = getAppConfig();
		const config = {
			...baseConfig,
			app: {
				...baseConfig.app,
				frontendUrl: "https://routess.com",
				frontendUrls: ["https://routess.com", "https://routess.be"],
			},
			docs: {
				...baseConfig.docs,
				enabled: false,
			},
		};

		configureApplication(app as unknown as INestApplication, config);

		const corsOptions = app.enableCors.mock.calls[0][0];
		const originHandler = corsOptions.origin as (
			origin: string | undefined,
			callback: (error: Error | null, allow?: boolean) => void,
		) => void;

		const allowedCallback = jest.fn();
		originHandler("https://routess.be", allowedCallback);

		const noOriginCallback = jest.fn();
		originHandler(undefined, noOriginCallback);

		expect(allowedCallback).toHaveBeenCalledWith(null, true);
		expect(noOriginCallback).toHaveBeenCalledWith(null, true);
	});

	it("rejects origins outside the configured allowlist", () => {
		const app = createMockApp();
		const baseConfig = getAppConfig();
		const config = {
			...baseConfig,
			app: {
				...baseConfig.app,
				frontendUrl: "https://routess.com",
				frontendUrls: ["https://routess.com", "https://routess.be"],
			},
			docs: {
				...baseConfig.docs,
				enabled: false,
			},
		};

		configureApplication(app as unknown as INestApplication, config);

		const corsOptions = app.enableCors.mock.calls[0][0];
		const originHandler = corsOptions.origin as (
			origin: string | undefined,
			callback: (error: Error | null, allow?: boolean) => void,
		) => void;

		const rejectedCallback = jest.fn();
		originHandler("https://evil.example", rejectedCallback);

		expect(rejectedCallback).toHaveBeenCalledWith(expect.any(Error), false);
		expect(rejectedCallback.mock.calls[0][0]?.message).toContain("not allowed by CORS");
	});
});
