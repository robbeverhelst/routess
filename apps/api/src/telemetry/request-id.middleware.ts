import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

export interface RequestWithId extends Request {
	id: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
	use(req: RequestWithId, res: Response, next: NextFunction) {
		// Use the client-supplied request ID when it looks sane (the api-client
		// sends a UUID); otherwise generate one. The charset/length guard keeps
		// arbitrary client input out of logs.
		const header = req.headers["x-request-id"];
		const candidate = typeof header === "string" ? header : undefined;
		const requestId = candidate && /^[\w-]{8,64}$/.test(candidate) ? candidate : randomUUID();

		// Attach to request object
		req.id = requestId;

		// Add to response headers
		res.setHeader("X-Request-ID", requestId);

		next();
	}
}
