import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
	constructor(private metricsService: MetricsService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const startTime = Date.now();
		const ctx = context.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();

		return next.handle().pipe(
			tap(() => {
				const duration = Date.now() - startTime;
				const route = request.route?.path || request.path;
				const method = request.method;
				const statusCode = response.statusCode;

				this.metricsService.recordHttpRequest(method, route, statusCode, duration);
			}),
		);
	}
}
