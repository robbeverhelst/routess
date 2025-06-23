import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { GlobalExceptionFilter } from "../../../src/common/filters/global-exception.filter";

describe("GlobalExceptionFilter", () => {
  let filter: GlobalExceptionFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: Partial<Response>;
  let mockRequest: any;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Set to test mode to avoid stack traces in most tests
    process.env.NODE_ENV = "test";
    filter = new GlobalExceptionFilter();

    mockRequest = {
      method: "GET",
      url: "/test",
    };

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
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  it("should be defined", () => {
    expect(filter).toBeDefined();
  });

  it("should handle HttpException correctly", () => {
    const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String),
      path: "/test",
      method: "GET",
      error: "Bad Request",
      message: ["Test error"],
    });
  });

  it("should handle generic Error correctly", () => {
    const exception = new Error("Generic error");

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      timestamp: expect.any(String),
      path: "/test",
      method: "GET",
      error: "Internal Server Error",
      message: ["Internal server error"],
    });
  });

  it("should handle HttpException with object response", () => {
    const exceptionResponse = {
      message: ["Validation failed", "Name is required"],
      error: "Bad Request",
    };
    const exception = new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String),
      path: "/test",
      method: "GET",
      error: "Bad Request",
      message: ["Validation failed", "Name is required"],
    });
  });

  it("should include stack trace in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const exception = new Error("Test error");

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.any(String),
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });

  it("should not include stack trace in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const exception = new Error("Test error");

    filter.catch(exception, mockArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it("should convert single message to array", () => {
    const exception = new HttpException("Single message", HttpStatus.NOT_FOUND);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ["Single message"],
      }),
    );
  });
});
