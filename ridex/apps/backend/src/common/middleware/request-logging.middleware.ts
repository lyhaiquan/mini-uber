import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";

import { StructuredLogger } from "../logging/structured-logger";
import { getRequestId, type RequestWithCorrelationId } from "../request-context";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLogger) {}

  use(request: RequestWithCorrelationId, response: Response, next: NextFunction): void {
    const startedAt = Date.now();

    response.on("finish", () => {
      this.logger.log(
        {
          event: "http.request.completed",
          correlationId: getRequestId(request),
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt
        },
        RequestLoggingMiddleware.name
      );
    });

    next();
  }
}
