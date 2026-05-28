import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptOffer,
  rejectOffer,
  RIDE_OFFER_ACCEPT_EVENT,
  RIDE_OFFER_CANCELLED_EVENT,
  RIDE_OFFER_ERROR_EVENT,
  RIDE_OFFER_RECEIVED_EVENT,
  RIDE_OFFER_REJECT_EVENT,
  withAckTimeout,
  type OfferAck
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

describe("withAckTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the backend ack when it arrives before the timeout", async () => {
    const slow = new Promise<OfferAck>((resolve) =>
      setTimeout(() => resolve({ ok: true }), 50)
    );
    const wrapped = withAckTimeout(slow, 3_000);
    await vi.advanceTimersByTimeAsync(50);
    await expect(wrapped).resolves.toEqual({ ok: true });
  });

  it("fabricates a TIMEOUT ack (not ALREADY_FINALIZED) when the backend never replies", async () => {
    // Regression: previously this returned ALREADY_FINALIZED, which made
    // the UI show "ride was taken" instead of "network slow, retry".
    const never = new Promise<OfferAck>(() => undefined);
    const wrapped = withAckTimeout(never, 3_000);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(wrapped).resolves.toEqual({
      ok: false,
      error: { code: "TIMEOUT" }
    });
  });

  it("prefers the backend ack when both fire in the same tick", async () => {
    const fast = Promise.resolve<OfferAck>({
      ok: false,
      error: { code: "ALREADY_FINALIZED" }
    });
    const wrapped = withAckTimeout(fast, 0);
    // Real race resolves to the backend ack because microtasks run before
    // setTimeout(0). UI must see ALREADY_FINALIZED, not TIMEOUT.
    await expect(wrapped).resolves.toEqual({
      ok: false,
      error: { code: "ALREADY_FINALIZED" }
    });
  });
});
