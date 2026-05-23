import type { Response } from "express";

import type { StructuredLogger } from "../logging/structured-logger";
import type { RequestWithCorrelationId } from "../request-context";
import { RequestLoggingMiddleware } from "./request-logging.middleware";

describe("RequestLoggingMiddleware", () => {
  it("logs request completion with correlation and timing fields", () => {
    const logger = {
      log: jest.fn()
    } as unknown as StructuredLogger;
    const middleware = new RequestLoggingMiddleware(logger);
    const request = {
      method: "POST",
      originalUrl: "/api/v1/example",
      correlationId: "request-log-id",
      header: jest.fn()
    } as unknown as RequestWithCorrelationId;
    const finishHandlers: Array<() => void> = [];
    const response = createResponse(201, finishHandlers);
    const next = jest.fn();

    middleware.use(request, response, next);
    finishHandlers[0]?.();

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "http.request.completed",
        correlationId: "request-log-id",
        method: "POST",
        path: "/api/v1/example",
        statusCode: 201,
        durationMs: expect.any(Number)
      }),
      RequestLoggingMiddleware.name
    );
  });
});

function createResponse(statusCode: number, finishHandlers: Array<() => void>): Response {
  const response: Pick<Response, "statusCode" | "on"> = {
    statusCode,
    on: jest.fn((eventName: string, handler: () => void): Response => {
      if (eventName === "finish") {
        finishHandlers.push(handler);
      }

      return response as Response;
    })
  };

  return response as unknown as Response;
}
