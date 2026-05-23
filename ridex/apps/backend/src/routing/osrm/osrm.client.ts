import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { OSRM_PROFILE } from "../routing.constants";
import type { RouteCoordinate } from "../routing.types";
import type { OsrmRouteApiResponse, OsrmRouteResponse } from "./osrm-response.types";

const CONTEXT = "OsrmClient";
const OSRM_ROUTE_QUERY = "overview=full&geometries=polyline&alternatives=false&steps=false";

@Injectable()
export class OsrmClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: StructuredLogger
  ) {
    this.baseUrl = configService.get("OSRM_BASE_URL", { infer: true }).replace(/\/+$/, "");
    this.timeoutMs = configService.get("OSRM_TIMEOUT_MS", { infer: true });
  }

  async fetchRoute(
    pickup: RouteCoordinate,
    destination: RouteCoordinate
  ): Promise<OsrmRouteResponse | null> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(this.buildRouteUrl(pickup, destination), {
        signal: controller.signal
      });

      if (!response.ok) {
        this.warnFailure("routing.osrm.http_error", "OsrmHttpError", {
          httpStatus: response.status
        });
        return null;
      }

      const parsedBody = await this.parseJson(response);
      if (parsedBody === null) {
        return null;
      }

      if (parsedBody.code !== "Ok") {
        this.warnFailure("routing.osrm.no_route", "OsrmNoRoute", {
          osrmCode: parsedBody.code ?? "MissingCode"
        });
        return null;
      }

      if (!Array.isArray(parsedBody.routes) || parsedBody.routes.length === 0) {
        this.warnFailure("routing.osrm.empty_routes", "OsrmEmptyRoutes", {
          osrmCode: parsedBody.code
        });
        return null;
      }

      const route = parsedBody.routes[0];
      if (!this.isValidRoute(route)) {
        this.warnFailure("routing.osrm.invalid_route", "OsrmInvalidRoute", {
          osrmCode: parsedBody.code
        });
        return null;
      }

      return route;
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      const event =
        errorName === "AbortError" ? "routing.osrm.timeout" : "routing.osrm.network_error";
      this.warnFailure(event, errorName);
      return null;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async parseJson(response: Response): Promise<OsrmRouteApiResponse | null> {
    try {
      const body: unknown = await response.json();

      if (!this.isRecord(body)) {
        this.warnFailure("routing.osrm.parse_error", "OsrmInvalidJson");
        return null;
      }

      return body;
    } catch (error: unknown) {
      this.warnFailure(
        "routing.osrm.parse_error",
        error instanceof Error ? error.name : "UnknownError"
      );
      return null;
    }
  }

  private buildRouteUrl(pickup: RouteCoordinate, destination: RouteCoordinate): string {
    return `${this.baseUrl}/route/v1/${OSRM_PROFILE}/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?${OSRM_ROUTE_QUERY}`;
  }

  private isValidRoute(value: unknown): value is OsrmRouteResponse {
    if (!this.isRecord(value)) {
      return false;
    }
    const distance = value.distance;
    const duration = value.duration;
    const geometry = value.geometry;

    return (
      typeof distance === "number" &&
      Number.isFinite(distance) &&
      distance >= 0 &&
      typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration >= 0 &&
      typeof geometry === "string"
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private warnFailure(
    event: string,
    errorName: string,
    fields: Record<string, unknown> = {}
  ): void {
    this.logger.warn(
      {
        event,
        errorName,
        ...fields
      },
      CONTEXT
    );
  }
}
