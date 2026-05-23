import { describe, expect, it, vi } from "vitest";

import {
  acceptOffer,
  rejectOffer,
  RIDE_OFFER_ACCEPT_EVENT,
  RIDE_OFFER_CANCELLED_EVENT,
  RIDE_OFFER_ERROR_EVENT,
  RIDE_OFFER_RECEIVED_EVENT,
  RIDE_OFFER_REJECT_EVENT
} from "../index";

describe("offer wire constants", () => {
  it("matches backend matching.constants exactly", () => {
    expect(RIDE_OFFER_RECEIVED_EVENT).toBe("ride.offer.received");
    expect(RIDE_OFFER_CANCELLED_EVENT).toBe("ride.offer.cancelled");
    expect(RIDE_OFFER_ERROR_EVENT).toBe("ride.offer.error");
    expect(RIDE_OFFER_ACCEPT_EVENT).toBe("ride.offer.accept");
    expect(RIDE_OFFER_REJECT_EVENT).toBe("ride.offer.reject");
  });
});

describe("acceptOffer", () => {
  it("emits ride.offer.accept with the offerId and resolves the ack", async () => {
    const socket = {
      emit: vi.fn((event: string, payload: { offerId: string }, ack: (a: unknown) => void) => {
        expect(event).toBe(RIDE_OFFER_ACCEPT_EVENT);
        expect(payload).toEqual({ offerId: "offer-1" });
        ack({ ok: true });
      })
    } as never;

    await expect(acceptOffer(socket, "offer-1")).resolves.toEqual({ ok: true });
  });

  it("surfaces an ALREADY_FINALIZED error from the gateway", async () => {
    const socket = {
      emit: vi.fn((_event, _payload, ack: (a: unknown) => void) =>
        ack({ ok: false, error: { code: "ALREADY_FINALIZED", offerId: "offer-1" } })
      )
    } as never;

    await expect(acceptOffer(socket, "offer-1")).resolves.toEqual({
      ok: false,
      error: { code: "ALREADY_FINALIZED", offerId: "offer-1" }
    });
  });
});

describe("rejectOffer", () => {
  it("defaults reason to 'driver_declined' when none is supplied", async () => {
    const socket = {
      emit: vi.fn((event: string, payload: { offerId: string; reason: string }, ack: (a: unknown) => void) => {
        expect(event).toBe(RIDE_OFFER_REJECT_EVENT);
        expect(payload).toEqual({ offerId: "offer-2", reason: "driver_declined" });
        ack({ ok: true });
      })
    } as never;

    await expect(rejectOffer(socket, "offer-2")).resolves.toEqual({ ok: true });
  });

  it("passes through a custom reason verbatim", async () => {
    const socket = {
      emit: vi.fn((_event, payload: { reason: string }, ack: (a: unknown) => void) => {
        expect(payload.reason).toBe("too_far");
        ack({ ok: true });
      })
    } as never;

    await rejectOffer(socket, "offer-3", "too_far");
  });
});
