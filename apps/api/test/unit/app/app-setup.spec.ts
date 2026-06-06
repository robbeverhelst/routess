import type { INestApplication } from "@nestjs/common";
import { configureApplication } from "../../../src/app/app-setup";
import { getAppConfig } from "../../../src/config/app-config";

describe("configureApplication", () => {
	function createMockApp() {
		return {
			use: jest.fn(),
			useBodyParser: jest.fn(),
			enableVersioning: jest.fn(),
			useGlobalFilters: jest.fn(),
			useGlobalPipes: jest.fn(),
			enableCors: jest.fn(),
		} satisfies Record<string, jest.Mock>;
	}

	// The origin-check middleware is the last app.use registration (after
	// compression and helmet).
	function getOriginCheckMiddleware(app: ReturnType<typeof createMockApp>) {
		const call = app.use.mock.calls.at(-1);
		if (!call) throw new Error("no app.use calls recorded");
		return call[0] as (
			req: { method: string; headers: Record<string, string | undefined> },
			res: { status: jest.Mock; json: jest.Mock },
			next: jest.Mock,
		) => void;
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

	describe("CSRF origin check", () => {
		function setup() {
			const app = createMockApp();
			const baseConfig = getAppConfig();
			const config = {
				...baseConfig,
				app: {
					...baseConfig.app,
					frontendUrl: "https://routess.com",
					frontendUrls: ["https://routess.com"],
				},
				docs: { ...baseConfig.docs, enabled: false },
			};
			configureApplication(app as unknown as INestApplication, config);
			return getOriginCheckMiddleware(app);
		}

		function createRes() {
			const res = { status: jest.fn(), json: jest.fn() };
			res.status.mockReturnValue(res);
			return res;
		}

		it("rejects mutations from an untrusted origin with 403", () => {
			const middleware = setup();
			const res = createRes();
			const next = jest.fn();

			middleware({ method: "POST", headers: { origin: "https://evil.example" } }, res, next);

			expect(next).not.toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "FORBIDDEN_ORIGIN" }));
		});

		it("allows mutations from an allowlisted origin", () => {
			const middleware = setup();
			const res = createRes();
			const next = jest.fn();

			middleware({ method: "DELETE", headers: { origin: "https://routess.com" } }, res, next);

			expect(next).toHaveBeenCalled();
			expect(res.status).not.toHaveBeenCalled();
		});

		it("allows mutations without an Origin header (non-browser clients)", () => {
			const middleware = setup();
			const res = createRes();
			const next = jest.fn();

			middleware({ method: "PATCH", headers: {} }, res, next);

			expect(next).toHaveBeenCalled();
			expect(res.status).not.toHaveBeenCalled();
		});

		it("allows safe methods from any origin", () => {
			const middleware = setup();
			const res = createRes();
			const next = jest.fn();

			middleware({ method: "GET", headers: { origin: "https://evil.example" } }, res, next);

			expect(next).toHaveBeenCalled();
			expect(res.status).not.toHaveBeenCalled();
		});
	});
});
