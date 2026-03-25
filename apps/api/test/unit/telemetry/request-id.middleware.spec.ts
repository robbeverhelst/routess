import type { NextFunction, Response } from "express";
import { RequestIdMiddleware, type RequestWithId } from "../../../src/telemetry/request-id.middleware";

describe("RequestIdMiddleware", () => {
	let middleware: RequestIdMiddleware;
	let mockRequest: Partial<RequestWithId>;
	let mockResponse: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		middleware = new RequestIdMiddleware();
		mockRequest = {
			headers: {},
		};
		mockResponse = {
			setHeader: jest.fn(),
		};
		mockNext = jest.fn();
	});

	it("should be defined", () => {
		expect(middleware).toBeDefined();
	});

	it("should generate a new request ID when none is provided", () => {
		middleware.use(mockRequest as RequestWithId, mockResponse as Response, mockNext);

		expect(mockRequest.id).toBeDefined();
		expect(mockRequest.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
		expect(mockResponse.setHeader).toHaveBeenCalledWith("X-Request-ID", mockRequest.id);
		expect(mockNext).toHaveBeenCalled();
	});

	it("should use existing request ID from header", () => {
		const existingId = "existing-request-id-123";
		if (mockRequest.headers) {
			mockRequest.headers["x-request-id"] = existingId;
		}

		middleware.use(mockRequest as RequestWithId, mockResponse as Response, mockNext);

		expect(mockRequest.id).toBe(existingId);
		expect(mockResponse.setHeader).toHaveBeenCalledWith("X-Request-ID", existingId);
		expect(mockNext).toHaveBeenCalled();
	});

	it("should handle multiple request ID headers correctly", () => {
		const requestId = "test-id-456";
		if (mockRequest.headers) {
			mockRequest.headers["x-request-id"] = requestId;
		}

		middleware.use(mockRequest as RequestWithId, mockResponse as Response, mockNext);

		expect(mockRequest.id).toBe(requestId);
		expect(mockResponse.setHeader).toHaveBeenCalledTimes(1);
		expect(mockResponse.setHeader).toHaveBeenCalledWith("X-Request-ID", requestId);
	});

	it("should generate unique IDs for different requests", () => {
		const request1 = { headers: {} } as RequestWithId;
		const request2 = { headers: {} } as RequestWithId;

		middleware.use(request1, mockResponse as Response, mockNext);
		middleware.use(request2, mockResponse as Response, mockNext);

		expect(request1.id).toBeDefined();
		expect(request2.id).toBeDefined();
		expect(request1.id).not.toBe(request2.id);
	});
});
