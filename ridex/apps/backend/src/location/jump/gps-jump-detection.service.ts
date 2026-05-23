import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/env.validation";
import type { CachedLocation } from "../cache/cached-location.types";
import { haversine } from "./haversine";

export type GpsJumpRejectionCode =
  | "STALE_TIMESTAMP"
  | "GPS_JUMP_DISTANCE"
  | "GPS_JUMP_SPEED";

export type GpsJumpDecision =
  | { allowed: true }
  | { allowed: false; code: GpsJumpRejectionCode };

export interface NextLocationForJumpDetection {
  lat: number;
  lng: number;
  recordedAt: Date;
}

@Injectable()
export class GpsJumpDetectionService {
  private readonly maxSpeedMps: number;
  private readonly maxJumpMeters: number;
  private readonly jumpDetectionWindowSeconds: number;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.maxSpeedMps = configService.get("LOCATION_MAX_SPEED_MPS", { infer: true });
    this.maxJumpMeters = configService.get("LOCATION_MAX_JUMP_METERS", { infer: true });
    this.jumpDetectionWindowSeconds = configService.get(
      "LOCATION_JUMP_DETECTION_WINDOW_SECONDS",
      { infer: true }
    );
  }

  evaluate(prev: CachedLocation | null, next: NextLocationForJumpDetection): GpsJumpDecision {
    if (prev === null) {
      return { allowed: true };
    }

    const prevAt = Date.parse(prev.recordedAt);
    const nextAt = next.recordedAt.getTime();
    const elapsedSeconds = (nextAt - prevAt) / 1000;

    if (elapsedSeconds <= 0 || Number.isNaN(elapsedSeconds)) {
      return { allowed: false, code: "STALE_TIMESTAMP" };
    }

    if (elapsedSeconds > this.jumpDetectionWindowSeconds) {
      return { allowed: true };
    }

    const distanceMeters = haversine(prev.lat, prev.lng, next.lat, next.lng);

    if (distanceMeters > this.maxJumpMeters) {
      return { allowed: false, code: "GPS_JUMP_DISTANCE" };
    }

    const computedSpeedMps = distanceMeters / elapsedSeconds;

    if (computedSpeedMps > this.maxSpeedMps) {
      return { allowed: false, code: "GPS_JUMP_SPEED" };
    }

    return { allowed: true };
  }
}

