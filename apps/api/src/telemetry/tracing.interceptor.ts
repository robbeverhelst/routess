import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import { SpanStatusCode } from "@opentelemetry/api";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { RequestWithId } from "./request-id.middleware";
import { getTracer } from "./tracing";

@Injectable()
export class TracingInterceptor implements NestInterceptor {
	private tracer = getTracer();

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const ctx = context.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse();

		const spanName = `${request.method} ${request.route?.path || request.path}`;

		// Start a new span for this request
		const span = this.tracer.startSpan(spanName, {
			attributes: {
				"http.method": request.method,
				"http.url": request.url,
				"http.target": request.path,
				"http.host": request.headers.host || "unknown",
				"http.scheme": request.protocol,
				"http.user_agent": request.headers["user-agent"] || "unknown",
				"request.id": (request as RequestWithId).id || request.headers["x-request-id"],
			},
		});

		// Execute within the span context
		return next.handle().pipe(
			tap({
				next: () => {
					// Success - set span status and attributes
					span.setAttributes({
						"http.status_code": response.statusCode,
						"http.response.size": response.get("content-length") || 0,
					});
					span.setStatus({ code: SpanStatusCode.OK });
				},
				error: (error) => {
					// Error - record exception and set error status
					span.recordException(error);
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: error.message,
					});
					span.setAttributes({
						"http.status_code": response.statusCode || 500,
					});
				},
				complete: () => {
					// Always end the span
					span.end();
				},
			}),
		);
	}
}
