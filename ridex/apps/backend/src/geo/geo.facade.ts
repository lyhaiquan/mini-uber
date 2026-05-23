import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../config/env.validation";
import { H3Service } from "./h3.service";
import { H3RedisIndexService } from "./redis/h3-redis-index.service";

export class InvalidDiscoveryRingError extends Error {
  constructor(value: number) {
    super(`Invalid discovery ring: ${value}`);
    this.name = "InvalidDiscoveryRingError";
  }
}

export interface FindNearbyDriversInput {
  lat: number;
  lng: number;
  /**
   * Number of H3 rings to expand around the pickup cell at each resolution.
   * Defaults to H3_DISCOVERY_MAX_RING. Values above the cap are clamped;
   * negative and non-finite values throw InvalidDiscoveryRingError.
   */
  maxRing?: number;
}

@Injectable()
export class GeoFacade {
  private readonly maxRingCap: number;

  constructor(
    private readonly indexService: H3RedisIndexService,
    private readonly h3Service: H3Service,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.maxRingCap = configService.get("H3_DISCOVERY_MAX_RING", { infer: true });
  }

  async findNearbyDrivers(input: FindNearbyDriversInput): Promise<string[]> {
    const requested = input.maxRing ?? this.maxRingCap;
    const clamped = this.clampRing(requested);
    return this.indexService.findNearbyDrivers(input.lat, input.lng, clamped);
  }

  cellsForLocation(lat: number, lng: number): { r8: string; r9: string } {
    return this.h3Service.latLngToBothCells(lat, lng);
  }

  async getOnlineDriverCount(cellId: string, resolution: 8 | 9 = 8): Promise<number> {
    return this.indexService.getOnlineDriverCount(cellId, resolution);
  }

  private clampRing(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
      throw new InvalidDiscoveryRingError(value);
    }
    if (value > this.maxRingCap) {
      return this.maxRingCap;
    }
    return Math.floor(value);
  }
}
