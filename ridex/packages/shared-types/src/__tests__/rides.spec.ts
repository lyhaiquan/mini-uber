import { describe, expect, it } from "vitest";

import {
  createRideDtoSchema,
  isTerminalStatus,
  quoteRequestSchema,
  quoteResponseSchema,
  RIDE_ERROR_ALREADY_ACTIVE,
  rideResponseSchema,
  rideStatusSchema,
  transitionRideDtoSchema
} from "../rides";

describe("rides schemas", () => {
  it("accepts a valid CreateRideDto", () => {
    const parsed = createRideDtoSchema.parse({
      pickup: { lat: 10.77, lng: 106.7, address: "Pickup A" },
      destination: { lat: 10.8, lng: 106.71, address: "Destination B" }
    });
    expect(parsed.pickup.address).toBe("Pickup A");
  });

  it("rejects CreateRideDto with out-of-range latitude", () => {
    expect(() =>
      createRideDtoSchema.parse({
        pickup: { lat: 999, lng: 106.7, address: "x" },
        destination: { lat: 10.8, lng: 106.71, address: "y" }
      })
    ).toThrow();
  });

  it("recognizes terminal statuses", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
    expect(isTerminalStatus("NO_DRIVERS_FOUND")).toBe(true);
    expect(isTerminalStatus("ACCEPTED")).toBe(false);
    expect(isTerminalStatus("REQUESTED")).toBe(false);
  });

  it("rejects unknown ride status", () => {
    expect(() => rideStatusSchema.parse("DRIVING_FAST")).toThrow();
  });

  it("parses a full ride response", () => {
    const parsed = rideResponseSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      customerId: "22222222-2222-4222-8222-222222222222",
      driverUserId: null,
      status: "REQUESTED",
      pickup: { lat: 10.77, lng: 106.7, address: "A" },
      destination: { lat: 10.8, lng: 106.71, address: "B" },
      requestedAt: "2026-05-18T10:00:00.000Z",
      matchingStartedAt: null,
      acceptedAt: null,
      driverArrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      version: 0
    });
    expect(parsed.status).toBe("REQUESTED");
  });

  it("transition DTO uses backend `toStatus` field name", () => {
    const parsed = transitionRideDtoSchema.parse({
      toStatus: "ACCEPTED",
      expectedVersion: 1
    });
    expect(parsed.toStatus).toBe("ACCEPTED");
  });

  it("transition DTO is strict — rejects unknown fields like `targetStatus`", () => {
    const result = transitionRideDtoSchema.safeParse({
      targetStatus: "ACCEPTED"
    });
    expect(result.success).toBe(false);
  });

  it("transition DTO caps reason at 500 chars", () => {
    const result = transitionRideDtoSchema.safeParse({
      toStatus: "CANCELLED",
      reason: "x".repeat(501)
    });
    expect(result.success).toBe(false);
  });
});

describe("quoteRequestSchema", () => {
  it("accepts valid pickup + destination lat/lng", () => {
    const parsed = quoteRequestSchema.parse({
      pickup: { lat: 10.7769, lng: 106.7009 },
      destination: { lat: 10.8231, lng: 106.6297 }
    });
    expect(parsed.pickup.lat).toBeCloseTo(10.7769);
  });

  it("rejects out-of-range lat", () => {
    expect(() =>
      quoteRequestSchema.parse({
        pickup: { lat: 91, lng: 0 },
        destination: { lat: 0, lng: 0 }
      })
    ).toThrow();
  });
});

describe("quoteResponseSchema", () => {
  it("validates full breakdown", () => {
    const parsed = quoteResponseSchema.parse({
      distanceMeters: 12500,
      durationSeconds: 1500,
      baseFareVnd: 12000,
      perKmVnd: 5000,
      perMinVnd: 500,
      surgeMultiplier: 1.2,
      totalVnd: 105000,
      currency: "VND",
      routeConfidence: "high",
      estimatedAt: "2026-05-23T05:00:00.000Z",
      expiresInSeconds: 60
    });
    expect(parsed.totalVnd).toBe(105000);
  });
});

describe("RIDE_ERROR_ALREADY_ACTIVE", () => {
  it("is the canonical error code", () => {
    expect(RIDE_ERROR_ALREADY_ACTIVE).toBe("RIDE_ALREADY_ACTIVE");
  });
});
