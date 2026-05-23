import type { Response } from "express";

import { CORRELATION_ID_HEADER, type RequestWithCorrelationId } from "../request-context";
import { CorrelationIdMiddleware } from "./correlation-id.middleware";

describe("CorrelationIdMiddleware", () => {
  it("uses a safe inbound correlation ID", () => {
    const middleware = new CorrelationIdMiddleware();
    const request = createRequest("safe-request-id");
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.correlationId).toBe("safe-request-id");
    expect(response.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, "safe-request-id");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe inbound correlation ID and generates a new UUID", () => {
    const middleware = new CorrelationIdMiddleware();
    const request = createRequest("unsafe id with spaces");
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(request.correlationId).not.toBe("unsafe id with spaces");
    expect(response.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, request.correlationId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

function createRequest(correlationId: string): RequestWithCorrelationId {
  return {
    header: jest.fn((headerName: string) =>
      headerName.toLowerCase() === CORRELATION_ID_HEADER ? correlationId : undefined
    )
  } as unknown as RequestWithCorrelationId;
}

function createResponse(): Response {
  return {
    setHeader: jest.fn()
  } as unknown as Response;
}
