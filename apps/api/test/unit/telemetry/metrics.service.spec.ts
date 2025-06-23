import { Test, TestingModule } from "@nestjs/testing";
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

// Mock the tracing module
// const mockGetMeter = () => mockMeter;

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
          provide: "OTEL_METER",
          useValue: mockMeter,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);

    // Mock the meter and trigger initialization
    (service as any).meter = mockMeter;
    (service as any).initializeMetrics();
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
      expect(totalArgs).toEqual([
        1,
        { method: "GET", route: "/api/v1/routes", status_code: "200" },
      ]);
      expect(durationArgs).toEqual([
        150,
        { method: "GET", route: "/api/v1/routes", status_code: "200" },
      ]);
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
      expect(errorArgs[0]).toEqual([
        1,
        { method: "POST", route: "/api/v1/routes", status_code: "400" },
      ]);
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

    it("should track active users", () => {
      let callCount = 0;
      const callArgs: any[] = [];

      const mockActiveUsersCounter = {
        add: (...args: any[]) => {
          callCount++;
          callArgs.push(args);
        },
      };
      (service as any).activeUsers = mockActiveUsersCounter;

      service.incrementActiveUsers();
      expect(callCount).toBe(1);
      expect(callArgs[0]).toEqual([1]);

      service.decrementActiveUsers();
      expect(callCount).toBe(2);
      expect(callArgs[1]).toEqual([-1]);
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

    it("should update connection pool size", () => {
      let callCount = 0;
      const callArgs: any[] = [];

      const mockDbPoolCounter = {
        add: (...args: any[]) => {
          callCount++;
          callArgs.push(args);
        },
      };
      (service as any).dbConnectionPool = mockDbPoolCounter;

      service.updateConnectionPoolSize(5);

      expect(callCount).toBe(1);
      expect(callArgs[0]).toEqual([5]);
    });
  });
});
