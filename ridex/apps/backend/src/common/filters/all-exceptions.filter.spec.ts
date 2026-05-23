import { BadRequestException, HttpStatus, type ArgumentsHost } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";

import type { ApiErrorResponse } from "../api-response";
import { StructuredLogger } from "../logging/structured-logger";
import type { RequestWithCorrelationId } from "../request-context";
import type { EnvironmentVariables } from "../../config/env.validation";
import { AllExceptionsFilter } from "./all-exceptions.filter";

describe("AllExceptionsFilter", () => {
  it("returns validation details without leaking stack traces", () => {
    const filter = new AllExceptionsFilter(createLogger());
    const { host, response } = createArgumentsHost();

    filter.catch(
      new BadRequestException({
        message: ["name must be a string"],
        error: "Bad Request",
        statusCode: HttpStatus.BAD_REQUEST
      }),
      host
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "HTTP_BAD_REQUEST",
        message: "Request validation failed",
        details: {
          validationErrors: ["name must be a string"]
        }
      },
      meta: {
        requestId: "test-request-id"
      }
    });
  });

  it("returns a safe 500 error for unexpected exceptions", () => {
    const logger = createLogger();
    jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter(logger);
    const { host, response } = createArgumentsHost();

    filter.catch(new Error("database password leaked in provider error"), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = getJsonBody(response);

    expect(body).toEqual({
      error: {
        code: "HTTP_INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      },
      meta: {
        requestId: "test-request-id"
      }
    });
    expect(JSON.stringify(body)).not.toContain("database password leaked");
  });
});

function createArgumentsHost(): {
  host: ArgumentsHost;
  response: Pick<Response, "status" | "json">;
} {
  const request: RequestWithCorrelationId = {
    method: "GET",
    originalUrl: "/health",
    correlationId: "test-request-id",
    header: jest.fn()
  } as unknown as RequestWithCorrelationId;
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getRequest: <T = Request>() => request as T,
      getResponse: <T = Response>() => response as unknown as T,
      getNext: jest.fn()
    }),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn()
  };

  return { host, response };
}

function createLogger(): StructuredLogger {
  const configService = {
    get: jest.fn().mockReturnValue("log")
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return new StructuredLogger(configService);
}

function getJsonBody(response: Pick<Response, "json">): ApiErrorResponse {
  const mock = response.json as jest.MockedFunction<Response["json"]>;
  return mock.mock.calls[0]?.[0] as ApiErrorResponse;
}
