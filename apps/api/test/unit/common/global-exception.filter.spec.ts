import { type ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { DomainException } from "../../../src/common/exceptions/domain.exception";
import { GlobalExceptionFilter } from "../../../src/common/filters/global-exception.filter";

describe("GlobalExceptionFilter", () => {
	let filter: GlobalExceptionFilter;
	let mockArgumentsHost: ArgumentsHost;
	let mockResponse: Partial<Response>;
	let mockRequest: any;
	const originalEnv = process.env.NODE_ENV;

	beforeEach(() => {
		process.env.NODE_ENV = "test";
		filter = new GlobalExceptionFilter();

		mockRequest = { method: "GET", url: "/test" };

		mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};

		mockArgumentsHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getResponse: () => mockResponse,
				getRequest: () => mockRequest,
			}),
		} as any;
	});

	afterAll(() => {
		process.env.NODE_ENV = originalEnv;
	});

	it("should be defined", () => {
		expect(filter).toBeDefined();
	});

	it("infers VALIDATION_FAILED for a 400 HttpException with a string body", () => {
		filter.catch(new HttpException("Test error", HttpStatus.BAD_REQUEST), mockArgumentsHost);

		expect(mockResponse.status).toHaveBeenCalledWith(400);
		expect(mockResponse.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "VALIDATION_FAILED",
			message: "Test error",
		});
	});

	it("infers INTERNAL for a generic Error", () => {
		filter.catch(new Error("Generic error"), mockArgumentsHost);

		expect(mockResponse.status).toHaveBeenCalledWith(500);
		expect(mockResponse.json).toHaveBeenCalledWith({
			statusCode: 500,
			code: "INTERNAL",
			message: "Internal server error",
		});
	});

	it("surfaces a 4xx middleware error (e.g. PayloadTooLarge) instead of a 500", () => {
		// body-parser throws a plain Error with a statusCode, not an HttpException.
		const tooLarge = Object.assign(new Error("request entity too large"), { statusCode: 413 });
		filter.catch(tooLarge, mockArgumentsHost);

		expect(mockResponse.status).toHaveBeenCalledWith(413);
		expect(mockResponse.json).toHaveBeenCalledWith(
			expect.objectContaining({ statusCode: 413, message: "request entity too large" }),
		);
	});

	it("still treats a 5xx-coded non-HttpException as INTERNAL", () => {
		const upstream = Object.assign(new Error("bad gateway"), { statusCode: 502 });
		filter.catch(upstream, mockArgumentsHost);

		expect(mockResponse.status).toHaveBeenCalledWith(500);
		expect(mockResponse.json).toHaveBeenCalledWith({
			statusCode: 500,
			code: "INTERNAL",
			message: "Internal server error",
		});
	});

	it("collapses a multi-message validation body into details.messages", () => {
		const exceptionResponse = {
			message: ["Validation failed", "Name is required"],
			error: "Bad Request",
		};
		filter.catch(new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST), mockArgumentsHost);

		expect(mockResponse.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "VALIDATION_FAILED",
			message: "Validation failed",
			details: { messages: ["Validation failed", "Name is required"] },
		});
	});

	it("passes through a DomainException payload verbatim", () => {
		filter.catch(new DomainException(409, "CONFLICT", "Route name taken", { name: "weekend ride" }), mockArgumentsHost);

		expect(mockResponse.status).toHaveBeenCalledWith(409);
		expect(mockResponse.json).toHaveBeenCalledWith({
			statusCode: 409,
			code: "CONFLICT",
			message: "Route name taken",
			details: { name: "weekend ride" },
		});
	});

	it("includes a stack trace under details.stack in development", () => {
		process.env.NODE_ENV = "development";

		filter.catch(new Error("Test error"), mockArgumentsHost);

		expect(mockResponse.json).toHaveBeenCalledWith(
			expect.objectContaining({ details: expect.objectContaining({ stack: expect.any(String) }) }),
		);

		process.env.NODE_ENV = "test";
	});

	it("does not include a stack trace in production", () => {
		process.env.NODE_ENV = "production";

		filter.catch(new Error("Test error"), mockArgumentsHost);

		const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
		expect(callArgs.details).toBeUndefined();

		process.env.NODE_ENV = "test";
	});

	it("infers NOT_FOUND for a 404", () => {
		filter.catch(new HttpException("Single message", HttpStatus.NOT_FOUND), mockArgumentsHost);

		expect(mockResponse.json).toHaveBeenCalledWith({
			statusCode: 404,
			code: "NOT_FOUND",
			message: "Single message",
		});
	});
});
