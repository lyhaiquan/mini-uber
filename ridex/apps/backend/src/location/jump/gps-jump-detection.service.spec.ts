import type { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/env.validation";
import type { CachedLocation } from "../cache/cached-location.types";
import { GpsJumpDetectionService } from "./gps-jump-detection.service";

function createService(overrides: Partial<Record<keyof EnvironmentVariables, number>> = {}): GpsJumpDetectionService {
  const values: Partial<Record<keyof EnvironmentVariables, number>> = {
    LOCATION_MAX_SPEED_MPS: 55,
    LOCATION_MAX_JUMP_METERS: 1000,
    LOCATION_JUMP_DETECTION_WINDOW_SECONDS: 30,
    ...overrides
  };
  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => values[key])
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new GpsJumpDetectionService(configService);
}

function cached(recordedAt: string, lat = 10, lng = 106): CachedLocation {
  return {
    lat,
    lng,
    recordedAt,
    receivedAt: recordedAt
  };
}

describe("GpsJumpDetectionService", () => {
  it("allows when there is no previous location", () => {
    const service = createService();

    expect(
      service.evaluate(null, {
        lat: 10,
        lng: 106,
        recordedAt: new Date("2026-05-16T00:00:00.000Z")
      })
    ).toEqual({ allowed: true });
  });

  it("rejects stale or backward timestamps", () => {
    const service = createService();

    expect(
      service.evaluate(cached("2026-05-16T00:00:10.000Z"), {
        lat: 10,
        lng: 106,
        recordedAt: new Date("2026-05-16T00:00:09.000Z")
      })
    ).toEqual({ allowed: false, code: "STALE_TIMESTAMP" });
  });

  it("allows when previous location is outside the detection window", () => {
    const service = createService();

    expect(
      service.evaluate(cached("2026-05-16T00:00:00.000Z"), {
        lat: 50,
        lng: 50,
        recordedAt: new Date("2026-05-16T00:01:00.000Z")
      })
    ).toEqual({ allowed: true });
  });

  it("rejects excessive jump distance", () => {
    const service = createService();

    expect(
      service.evaluate(cached("2026-05-16T00:00:00.000Z"), {
        lat: 10.02,
        lng: 106,
        recordedAt: new Date("2026-05-16T00:00:10.000Z")
      })
    ).toEqual({ allowed: false, code: "GPS_JUMP_DISTANCE" });
  });

  it("rejects excessive computed speed", () => {
    const service = createService({ LOCATION_MAX_JUMP_METERS: 10_000 });

    expect(
      service.evaluate(cached("2026-05-16T00:00:00.000Z"), {
        lat: 10.001,
        lng: 106,
        recordedAt: new Date("2026-05-16T00:00:01.000Z")
      })
    ).toEqual({ allowed: false, code: "GPS_JUMP_SPEED" });
  });

  it("allows movement within distance and speed limits", () => {
    const service = createService();

    expect(
      service.evaluate(cached("2026-05-16T00:00:00.000Z"), {
        lat: 10.001,
        lng: 106,
        recordedAt: new Date("2026-05-16T00:00:10.000Z")
      })
    ).toEqual({ allowed: true });
  });
});

