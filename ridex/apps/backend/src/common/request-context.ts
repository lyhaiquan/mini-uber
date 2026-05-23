import type { Request } from "express";

export const CORRELATION_ID_HEADER = "x-correlation-id";
const MAX_CORRELATION_ID_LENGTH = 128;
const SAFE_CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export type RequestWithCorrelationId = Request & {
  correlationId?: string;
};

export function normalizeCorrelationId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (
    trimmedValue.length === 0 ||
    trimmedValue.length > MAX_CORRELATION_ID_LENGTH ||
    !SAFE_CORRELATION_ID_PATTERN.test(trimmedValue)
  ) {
    return undefined;
  }

  return trimmedValue;
}

export function getRequestId(request: RequestWithCorrelationId): string {
  const headerValue = request.header(CORRELATION_ID_HEADER);
  return request.correlationId ?? normalizeCorrelationId(headerValue) ?? "unknown";
}
