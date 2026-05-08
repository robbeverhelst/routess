import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { PinoLogger } from "nestjs-pino";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { AuthenticatedUser } from "../auth/authenticated-user";

// Emits a Pino log line with `audit: true` for every admin endpoint hit, so a
// log aggregator can build an audit trail without a dedicated table. See
// ADR-0015 ("audit deferred to Pino field for now").
@Injectable()
export class AuditInterceptor implements NestInterceptor {
	constructor(private readonly logger: PinoLogger) {
		this.logger.setContext("admin-audit");
	}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const ctx = context.switchToHttp();
		const request = ctx.getRequest<Request & { user?: AuthenticatedUser }>();
		const handler = context.getHandler();
		const className = context.getClass().name;
		const method = request.method;
		const path = request.route?.path || request.path;

		return next.handle().pipe(
			tap({
				next: () => this.emit("ok", request, className, handler.name, method, path),
				error: (err) => this.emit("error", request, className, handler.name, method, path, err),
			}),
		);
	}

	private emit(
		outcome: "ok" | "error",
		request: Request & { user?: AuthenticatedUser },
		controller: string,
		handler: string,
		method: string,
		path: string,
		error?: unknown,
	) {
		const actor = request.user ? { id: request.user.id, email: request.user.email, role: request.user.role } : null;
		this.logger.info(
			{
				audit: true,
				outcome,
				actor,
				controller,
				handler,
				method,
				path,
				params: request.params,
				query: request.query,
				requestId: (request as { id?: string }).id,
				...(error instanceof Error ? { error: { message: error.message, name: error.name } } : {}),
			},
			"admin action",
		);
	}
}
