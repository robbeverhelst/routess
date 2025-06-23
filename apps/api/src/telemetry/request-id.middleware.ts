import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export interface RequestWithId extends Request {
  id: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction) {
    // Use existing request ID from header or generate new one
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    // Attach to request object
    req.id = requestId;

    // Add to response headers
    res.setHeader("X-Request-ID", requestId);

    next();
  }
}
