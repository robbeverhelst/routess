import { getRepositoryToken } from "@mikro-orm/nestjs";
import { Test, type TestingModule } from "@nestjs/testing";
import { Route } from "../../../src/entities/route.entity";
import { User } from "../../../src/entities/user.entity";
import { MetricsService } from "../../../src/telemetry/metrics.service";

// Create mock functions for OpenTelemetry
const mockRecord = { fn: () => {} };
const mockAdd = { fn: () => {} };

const mockHistogram = {
	record: mockRecord.fn,
};

const mockCounter = {
	add: mockAdd.fn,
};

const mockUpDownCounter = {
	add: mockAdd.fn,
};

const mockMeter = {
	createHistogram: () => mockHistogram,
	createCounter: () => mockCounter,
	createUpDownCounter: () => mockUpDownCounter,
};

// Mock repositories
const mockRouteRepository = {
	count: () => Promise.resolve(0),
};

const mockUserRepository = {
	count: () => Promise.resolve(0),
};

describe("MetricsService", () => {
	let service: MetricsService;

	beforeEach(async () => {
		// Reset mocks
		mockRecord.fn = () => {};
		mockAdd.fn = () => {};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MetricsService,
				{
					provide: getRepositoryToken(Route),
					useValue: mockRouteRepository,
				},
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepository,
				},
				{
					provide: "OTEL_METER",
					useValue: mockMeter,
				},
			],
		}).compile();

		service = module.get<MetricsService>(MetricsService);

		// Mock the meter and skip async initialization for tests
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).meter = mockMeter;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).routeRepository = mockRouteRepository;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).userRepository = mockUserRepository;

		// Initialize metrics synchronously for tests
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).httpRequestDuration = mockHistogram;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).httpRequestTotal = mockCounter;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).httpRequestErrors = mockCounter;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).userRegistrations = mockCounter;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).routesCreated = mockCounter;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).routesDeleted = mockCounter;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).activeUsers = mockUpDownCounter;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).dbQueryDuration = mockHistogram;
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("HTTP Metrics", () => {
		it("should record HTTP request metrics", () => {
			let totalCalls = 0;
			let durationCalls = 0;
			let totalArgs: any;
			let durationArgs: any;

			// Create specific mocks for this test
			const mockTotal = {
				add: (count: number, labels: any) => {
					totalCalls++;
					totalArgs = [count, labels];
				},
			};
			const mockDuration = {
				record: (duration: number, labels: any) => {
					durationCalls++;
					durationArgs = [duration, labels];
				},
			};

			(service as any).httpRequestTotal = mockTotal;
			(service as any).httpRequestDuration = mockDuration;

			service.recordHttpRequest("GET", "/api/v1/routes", 200, 150);

			expect(totalCalls).toBe(1);
			expect(durationCalls).toBe(1);
			expect(totalArgs).toEqual([1, { method: "GET", route: "/api/v1/routes", status_code: "200" }]);
			expect(durationArgs).toEqual([150, { method: "GET", route: "/api/v1/routes", status_code: "200" }]);
		});

		it("should record error metrics for 4xx/5xx responses", () => {
			let errorCallCount = 0;
			const errorArgs: any[] = [];

			// Mock the error counter specifically
			const mockErrorCounter = {
				add: (...args: any[]) => {
					errorCallCount++;
					errorArgs.push(args);
				},
			};
			(service as any).httpRequestErrors = mockErrorCounter;

			service.recordHttpRequest("POST", "/api/v1/routes", 400, 50);

			expect(errorCallCount).toBe(1);
			expect(errorArgs[0]).toEqual([1, { method: "POST", route: "/api/v1/routes", status_code: "400" }]);
		});
	});

	describe("Business Metrics", () => {
		it("should record user registration metrics", () => {
			let callCount = 0;
			const callArgs: any[] = [];

			const mockUserRegCounter = {
				add: (...args: any[]) => {
					callCount++;
					callArgs.push(args);
				},
			};
			(service as any).userRegistrations = mockUserRegCounter;

			service.recordUserRegistration("google");

			expect(callCount).toBe(1);
			expect(callArgs[0]).toEqual([1, { type: "google" }]);
		});

		it("should record route creation metrics", () => {
			let callCount = 0;
			const callArgs: any[] = [];

			const mockRoutesCreatedCounter = {
				add: (...args: any[]) => {
					callCount++;
					callArgs.push(args);
				},
			};
			(service as any).routesCreated = mockRoutesCreatedCounter;

			service.recordRouteCreated(123);

			expect(callCount).toBe(1);
			expect(callArgs[0]).toEqual([1, { user_id: "123" }]);
		});

		it("should record route deletion metrics", () => {
			let callCount = 0;
			const callArgs: any[] = [];

			const mockRoutesDeletedCounter = {
				add: (...args: any[]) => {
					callCount++;
					callArgs.push(args);
				},
			};
			(service as any).routesDeleted = mockRoutesDeletedCounter;

			service.recordRouteDeleted(123);

			expect(callCount).toBe(1);
			expect(callArgs[0]).toEqual([1, { user_id: "123" }]);
		});

		it("should update active users by delta", () => {
			let callCount = 0;
			const callArgs: any[] = [];

			const mockActiveUsersCounter = {
				add: (...args: any[]) => {
					callCount++;
					callArgs.push(args);
				},
			};
			(service as any).activeUsers = mockActiveUsersCounter;
			(service as any).activeUsersCount = 0;

			service.setActiveUsers(3);
			expect(callCount).toBe(1);
			expect(callArgs[0]).toEqual([3]);

			service.setActiveUsers(5);
			expect(callCount).toBe(2);
			expect(callArgs[1]).toEqual([2]);

			service.setActiveUsers(5);
			expect(callCount).toBe(2);
		});
	});

	describe("Database Metrics", () => {
		it("should record database query metrics", () => {
			let callCount = 0;
			const callArgs: any[] = [];

			const mockDbQueryHistogram = {
				record: (...args: any[]) => {
					callCount++;
					callArgs.push(args);
				},
			};
			(service as any).dbQueryDuration = mockDbQueryHistogram;

			service.recordDbQuery("select", 25);

			expect(callCount).toBe(1);
			expect(callArgs[0]).toEqual([25, { operation: "select" }]);
		});
	});
});
