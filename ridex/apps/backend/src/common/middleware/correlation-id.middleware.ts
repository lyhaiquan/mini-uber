import { randomUUID } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";

import {
  CORRELATION_ID_HEADER,
  normalizeCorrelationId,
  type RequestWithCorrelationId
} from "../request-context";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelationId, response: Response, next: NextFunction): void {
    const inboundCorrelationId = normalizeCorrelationId(request.header(CORRELATION_ID_HEADER));
    const correlationId = inboundCorrelationId ?? randomUUID();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
