import { describe, expect, it } from "vitest";

import {
  WS_EVENTS,
  offerActionAckSchema,
  offerActionDtoSchema,
  offerCancelledPayloadSchema,
  offerErrorPayloadSchema,
  offerReceivedPayloadSchema
} from "../events";

describe("websocket event schemas", () => {
  it("uses backend wire names (ride.offer.received, not ride.offer.created)", () => {
    expect(WS_EVENTS.RIDE_OFFER_RECEIVED).toBe("ride.offer.received");
    expect(WS_EVENTS.RIDE_OFFER_CANCELLED).toBe("ride.offer.cancelled");
    expect(WS_EVENTS.RIDE_OFFER_ERROR).toBe("ride.offer.error");
    expect(WS_EVENTS.RIDE_OFFER_ACCEPT).toBe("ride.offer.accept");
    expect(WS_EVENTS.RIDE_OFFER_REJECT).toBe("ride.offer.reject");
    expect(WS_EVENTS.DRIVER_LOCATION_UPDATE).toBe("driver.location.update");
    expect(WS_EVENTS.WS_ERROR).toBe("ws:error");
  });

  it("parses an OfferReceived payload", () => {
    const parsed = offerReceivedPayloadSchema.parse({
      offerId: "11111111-1111-4111-8111-111111111111",
      rideId: "22222222-2222-4222-8222-222222222222",
      pickup: { lat: 10.77, lng: 106.7 },
      destination: { lat: 10.8, lng: 106.71 },
      distanceMeters: 1200,
      durationSeconds: 240,
      expiresAt: "2026-05-18T10:00:30.000Z",
      routeConfidence: "high"
    });
    expect(parsed.routeConfidence).toBe("high");
  });

  it("parses an OfferCancelled payload with TIMED_OUT reason", () => {
    const parsed = offerCancelledPayloadSchema.parse({
      offerId: "11111111-1111-4111-8111-111111111111",
      reason: "TIMED_OUT"
    });
    expect(parsed.reason).toBe("TIMED_OUT");
  });

  it("parses an OfferError payload", () => {
    const parsed = offerErrorPayloadSchema.parse({
      code: "OFFER_NOT_FOUND",
      offerId: "11111111-1111-4111-8111-111111111111"
    });
    expect(parsed.code).toBe("OFFER_NOT_FOUND");
  });

  it("OfferActionDto rejects spoofed driverId field (strict)", () => {
    const parsed = offerActionDtoSchema.safeParse({
      offerId: "11111111-1111-4111-8111-111111111111",
      driverId: "spoofed"
    });
    expect(parsed.success).toBe(false);
  });

  it("OfferActionAck discriminated by ok flag", () => {
    const ok = offerActionAckSchema.parse({ ok: true });
    expect(ok.ok).toBe(true);

    const err = offerActionAckSchema.parse({
      ok: false,
      error: { code: "NOT_FOR_DRIVER", offerId: "11111111-1111-4111-8111-111111111111" }
    });
    expect(err.ok).toBe(false);
  });
});
