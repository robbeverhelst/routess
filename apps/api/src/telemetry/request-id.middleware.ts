import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

export interface RequestWithId extends Request {
	id: string;
}

// Accept the client-supplied request ID when it looks sane (the api-client
// sends a UUID); the charset/length guard keeps arbitrary client input out
// of logs. Shared with pinoHttp's genReqId so the logger and the middleware
// agree on one id from the first log binding onward.
export function requestIdFromHeaders(headers: Request["headers"]): string | undefined {
	const header = headers["x-request-id"];
	return typeof header === "string" && /^[\w-]{8,64}$/.test(header) ? header : undefined;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
	use(req: RequestWithId, res: Response, next: NextFunction) {
		// pinoHttp's genReqId normally assigned an id already; fall back for
		// paths that bypass the logger middleware.
		const requestId = req.id || requestIdFromHeaders(req.headers) || randomUUID();

		// Attach to request object
		req.id = requestId;

		// Add to response headers
		res.setHeader("X-Request-ID", requestId);

		next();
	}
}
