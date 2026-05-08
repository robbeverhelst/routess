import {
	type CallHandler,
	type ExecutionContext,
	type HttpException,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
	constructor(private metricsService: MetricsService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const startTime = Date.now();
		const ctx = context.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();

		const record = (statusCode: number) => {
			const duration = Date.now() - startTime;
			const route = request.route?.path || request.path;
			this.metricsService.recordHttpRequest(request.method, route, statusCode, duration);
		};

		return next.handle().pipe(
			tap({
				next: () => record(response.statusCode),
				error: (err) => {
					// Status code lives on HttpException; fall back to whatever the response holds (or 500).
					const fromException = (err as HttpException)?.getStatus?.();
					const status = typeof fromException === "number" ? fromException : response.statusCode || 500;
					record(status);
				},
			}),
		);
	}
}
