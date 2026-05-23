import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter
} from "@nestjs/common";
import type { Request, Response } from "express";

import type { ApiErrorResponse } from "../api-response";
import { StructuredLogger } from "../logging/structured-logger";
import { getRequestId, type RequestWithCorrelationId } from "../request-context";

const ERROR_CODES_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "HTTP_BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "HTTP_UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "HTTP_FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "HTTP_NOT_FOUND",
  [HttpStatus.CONFLICT]: "HTTP_CONFLICT",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "HTTP_UNPROCESSABLE_ENTITY",
  [HttpStatus.TOO_MANY_REQUESTS]: "HTTP_TOO_MANY_REQUESTS",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "HTTP_INTERNAL_SERVER_ERROR"
};

interface HttpExceptionResponseBody {
  message?: string | string[];
  error?: string;
  code?: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithCorrelationId>();
    const statusCode = this.getStatusCode(exception);
    const requestId = getRequestId(request);
    const responseBody: ApiErrorResponse = {
      error: {
        code: this.getErrorCode(exception, statusCode),
        message: this.getSafeMessage(exception, statusCode),
        details: this.getDetails(exception, statusCode)
      },
      meta: {
        requestId
      }
    };

    if (responseBody.error.details === undefined) {
      delete responseBody.error.details;
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          event: "http.exception",
          correlationId: requestId,
          method: request.method,
          path: request.originalUrl,
          statusCode,
          errorName: this.getErrorName(exception)
        },
        this.getErrorStack(exception),
        AllExceptionsFilter.name
      );
    }

    response.status(statusCode).json(responseBody);
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorCode(exception: unknown, statusCode: number): string {
    const exceptionResponse = this.getHttpExceptionResponse(exception);

    if (typeof exceptionResponse?.code === "string" && exceptionResponse.code.length > 0) {
      return exceptionResponse.code;
    }

    return ERROR_CODES_BY_STATUS[statusCode] ?? `HTTP_${statusCode}`;
  }

  private getSafeMessage(exception: unknown, statusCode: number): string {
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal server error";
    }

    const exceptionResponse = this.getHttpExceptionResponse(exception);
    const message = exceptionResponse?.message;

    if (Array.isArray(message)) {
      return "Request validation failed";
    }

    if (typeof message === "string" && message.length > 0) {
      return message;
    }

    if (typeof exceptionResponse?.error === "string" && exceptionResponse.error.length > 0) {
      return exceptionResponse.error;
    }

    return "Request failed";
  }

  private getDetails(exception: unknown, statusCode: number): unknown {
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return undefined;
    }

    const exceptionResponse = this.getHttpExceptionResponse(exception);

    if (Array.isArray(exceptionResponse?.message)) {
      return {
        validationErrors: exceptionResponse.message
      };
    }

    return exceptionResponse?.details;
  }

  private getHttpExceptionResponse(exception: unknown): HttpExceptionResponseBody | undefined {
    if (!(exception instanceof HttpException)) {
      return undefined;
    }

    const response = exception.getResponse();

    if (typeof response === "string") {
      return {
        message: response
      };
    }

    if (this.isRecord(response)) {
      return response;
    }

    return undefined;
  }

  private getErrorName(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.name;
    }

    return "UnknownError";
  }

  private getErrorStack(exception: unknown): string | undefined {
    if (exception instanceof Error) {
      return exception.stack;
    }

    return undefined;
  }

  private isRecord(value: unknown): value is HttpExceptionResponseBody {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
