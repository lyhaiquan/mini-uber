import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { StructuredLogger } from "../common/logging/structured-logger";
import { haversine } from "../location/jump/haversine";
import type { EnvironmentVariables } from "../config/env.validation";
import { OsrmClient } from "./osrm/osrm.client";
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_LOW,
  OSRM_PROFILE,
  POLYLINE_FORMAT_V5
} from "./routing.constants";
import {
  InvalidRouteCoordinateError,
  type RouteCoordinate,
  type RouteEstimate
} from "./routing.types";

interface EstimateRouteInput {
  pickup: RouteCoordinate;
  destination: RouteCoordinate;
}

interface CachedRouteEstimate {
  estimate: RouteEstimate;
  expiresAtMs: number;
}

const CONTEXT = "RouteEstimator";
const COORDINATE_CACHE_PRECISION = 5;

@Injectable()
export class RouteEstimator {
  private readonly fallbackRoadFactor: number;
  private readonly fallbackCitySpeedKmh: number;
  private readonly cacheSize: number;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CachedRouteEstimate>();

  constructor(
    private readonly osrmClient: OsrmClient,
    configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: StructuredLogger
  ) {
    this.fallbackRoadFactor = configService.get("ROUTING_FALLBACK_ROAD_FACTOR", {
      infer: true
    });
    this.fallbackCitySpeedKmh = configService.get("ROUTING_FALLBACK_CITY_SPEED_KMH", {
      infer: true
    });
    this.cacheSize = configService.get("ROUTING_ESTIMATE_CACHE_SIZE", { infer: true });
    this.cacheTtlMs =
      configService.get("ROUTING_ESTIMATE_CACHE_TTL_SECONDS", { infer: true }) * 1000;
  }

  async estimate(input: EstimateRouteInput): Promise<RouteEstimate> {
    this.assertValidCoordinate(input.pickup, "pickup");
    this.assertValidCoordinate(input.destination, "destination");

    if (this.isIdenticalCoordinate(input.pickup, input.destination)) {
      return {
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: null,
        polylineFormat: null,
        confidence: CONFIDENCE_HIGH,
        source: "fallback"
      };
    }

    const cacheKey = this.cacheKey(input);
    const cachedEstimate = this.getCached(cacheKey);
    if (cachedEstimate !== null) {
      this.logger.debug(
        {
          event: "routing.estimate.cache_hit",
          cacheKey
        },
        CONTEXT
      );
      return cachedEstimate;
    }

    const osrmRoute = await this.osrmClient.fetchRoute(input.pickup, input.destination);

    if (osrmRoute !== null) {
      const estimate: RouteEstimate = {
        distanceMeters: Math.round(osrmRoute.distance),
        durationSeconds: Math.round(osrmRoute.duration),
        polyline: osrmRoute.geometry,
        polylineFormat: POLYLINE_FORMAT_V5,
        confidence: CONFIDENCE_HIGH,
        source: "osrm"
      };
      this.setCached(cacheKey, estimate);
      return estimate;
    }

    return this.haversineFallback(input.pickup, input.destination);
  }

  private haversineFallback(
    pickup: RouteCoordinate,
    destination: RouteCoordinate
  ): RouteEstimate {
    const straightLineMeters = haversine(
      pickup.lat,
      pickup.lng,
      destination.lat,
      destination.lng
    );
    const distanceMeters = Math.round(straightLineMeters * this.fallbackRoadFactor);
    const durationSeconds = Math.round(
      (distanceMeters / 1000 / this.fallbackCitySpeedKmh) * 3600
    );

    return {
      distanceMeters,
      durationSeconds,
      polyline: null,
      polylineFormat: null,
      confidence: CONFIDENCE_LOW,
      source: "fallback"
    };
  }

  private assertValidCoordinate(coordinate: RouteCoordinate, label: string): void {
    if (!this.isValidCoordinate(coordinate)) {
      throw new InvalidRouteCoordinateError(`Invalid ${label} route coordinate`);
    }
  }

  private isValidCoordinate(coordinate: RouteCoordinate): boolean {
    return (
      Number.isFinite(coordinate.lat) &&
      coordinate.lat >= -90 &&
      coordinate.lat <= 90 &&
      Number.isFinite(coordinate.lng) &&
      coordinate.lng >= -180 &&
      coordinate.lng <= 180
    );
  }

  private isIdenticalCoordinate(
    pickup: RouteCoordinate,
    destination: RouteCoordinate
  ): boolean {
    return pickup.lat === destination.lat && pickup.lng === destination.lng;
  }

  private cacheKey(input: EstimateRouteInput): string {
    const pickupLat = this.roundCoordinate(input.pickup.lat);
    const pickupLng = this.roundCoordinate(input.pickup.lng);
    const destinationLat = this.roundCoordinate(input.destination.lat);
    const destinationLng = this.roundCoordinate(input.destination.lng);
    return `${OSRM_PROFILE}:${pickupLat}:${pickupLng}:${destinationLat}:${destinationLng}`;
  }

  private roundCoordinate(value: number): string {
    return value.toFixed(COORDINATE_CACHE_PRECISION);
  }

  private getCached(cacheKey: string, nowMs: number = Date.now()): RouteEstimate | null {
    const cached = this.cache.get(cacheKey);
    if (cached === undefined) {
      return null;
    }

    if (cached.expiresAtMs <= nowMs) {
      this.cache.delete(cacheKey);
      return null;
    }

    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, cached);
    return cached.estimate;
  }

  private setCached(cacheKey: string, estimate: RouteEstimate, nowMs: number = Date.now()): void {
    if (estimate.confidence !== CONFIDENCE_HIGH) {
      return;
    }

    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
    }
    this.cache.set(cacheKey, {
      estimate,
      expiresAtMs: nowMs + this.cacheTtlMs
    });

    while (this.cache.size > this.cacheSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        return;
      }
      this.cache.delete(oldestKey);
    }
  }
}
