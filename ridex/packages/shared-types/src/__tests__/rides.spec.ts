import { describe, expect, it } from "vitest";

import {
  createRideDtoSchema,
  isTerminalStatus,
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
