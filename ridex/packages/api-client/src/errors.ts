import type { ApiError } from "@ridex/shared-types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const message = errorMessage(body) ?? `API request failed with status ${status}`;
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
  }

  get code(): string | undefined {
    return errorCode(this.body);
  }
}

export class ApiAuthError extends Error {
  constructor(message = "Authentication refresh failed") {
    super(message);
    this.name = "ApiAuthError";
  }
}

export function errorCode(body: unknown): string | undefined {
  const candidate = body as Partial<ApiError> | { code?: unknown } | null;
  if (!candidate) return undefined;
  if (typeof (candidate as { code?: unknown }).code === "string") {
    return (candidate as { code: string }).code;
  }
  if (
    typeof (candidate as Partial<ApiError>).error?.code === "string"
  ) {
    return (candidate as ApiError).error.code;
  }
  return undefined;
}

export function errorMessage(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const candidate = body as Record<string, unknown>;
  const message = candidate.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(", ");

  const error = candidate.error;
  if (typeof error === "object" && error !== null) {
    const nestedMessage = (error as Record<string, unknown>).message;
    if (typeof nestedMessage === "string") return nestedMessage;
  }

  return undefined;
}
