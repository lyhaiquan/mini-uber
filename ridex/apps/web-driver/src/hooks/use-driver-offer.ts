"use client";

import {
  acceptOffer,
  rejectOffer,
  RIDE_OFFER_CANCELLED_EVENT,
  RIDE_OFFER_RECEIVED_EVENT,
  type OfferAck,
  type OfferCancelledPayload,
  type OfferReceivedPayload
} from "@ridex/socket-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { driversApi } from "@/lib/api";
import { getDriverSocket } from "@/lib/socket";

export const offerKeys = {
  all: ["offers"] as const,
  current: () => [...offerKeys.all, "current"] as const
};

const REST_POLL_INTERVAL_MS = 3_000;

export interface UseDriverOfferResult {
  offer: OfferReceivedPayload | null;
  // Returned for the modal's "respond" actions. Both resolve with the typed
  // ack so the UI can roll back optimistically when the backend says the
  // offer is already finalized (race lost).
  accept: (offerId: string) => Promise<OfferAck>;
  reject: (offerId: string, reason?: string) => Promise<OfferAck>;
  clear: () => void;
}

// Listens for ride.offer.received / ride.offer.cancelled on the driver socket
// and exposes a single 'current offer' state. REST polling acts as a fallback
// while the socket is reconnecting after a reload — once a WS push arrives
// it overwrites the polled value.
export function useDriverOffer(opts: { enabled: boolean }): UseDriverOfferResult {
  const { enabled } = opts;
  const qc = useQueryClient();
  const [offer, setOffer] = React.useState<OfferReceivedPayload | null>(null);

  // Poll only while the driver is online AND no offer is in hand. The
  // moment a WS push arrives we stop polling — paying both REST and WS for
  // the same data would be wasteful.
  useQuery({
    queryKey: offerKeys.current(),
    queryFn: () => driversApi.getCurrentOffer(),
    enabled: enabled && offer === null,
    refetchInterval: REST_POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
    // Side effect kept inside the queryFn instead of an effect so we don't
    // double-set when both REST and WS land in the same tick.
    select: (data) => {
      if (data !== null && offer === null) {
        setOffer(data);
      }
      return data;
    }
  });

  React.useEffect(() => {
    if (!enabled) return;
    const socket = getDriverSocket();
    if (!socket.connected) socket.connect();

    const onReceived = (payload: OfferReceivedPayload) => {
      setOffer(payload);
      // Drop the polled value so we don't bounce between WS and REST data.
      void qc.invalidateQueries({ queryKey: offerKeys.current() });
    };
    const onCancelled = (payload: OfferCancelledPayload) => {
      // Only clear if the cancellation refers to the offer we are showing.
      // The 'two offers in flight' edge case is defensive — backend already
      // guarantees one OFFERED row per driver.
      setOffer((current) =>
        current !== null && current.offerId === payload.offerId ? null : current
      );
    };
    socket.on(RIDE_OFFER_RECEIVED_EVENT, onReceived);
    socket.on(RIDE_OFFER_CANCELLED_EVENT, onCancelled);

    return () => {
      socket.off(RIDE_OFFER_RECEIVED_EVENT, onReceived);
      socket.off(RIDE_OFFER_CANCELLED_EVENT, onCancelled);
    };
  }, [enabled, qc]);

  const accept = React.useCallback(async (offerId: string) => {
    const socket = getDriverSocket();
    const ack = await withTimeout(acceptOffer(socket, offerId), 3_000);
    if (ack.ok) {
      setOffer(null);
    }
    return ack;
  }, []);

  const reject = React.useCallback(async (offerId: string, reason?: string) => {
    const socket = getDriverSocket();
    const ack = await withTimeout(rejectOffer(socket, offerId, reason), 3_000);
    // Optimistically clear — even a race-lost reject leaves the driver
    // free of this particular offer.
    setOffer(null);
    return ack;
  }, []);

  const clear = React.useCallback(() => setOffer(null), []);

  return { offer, accept, reject, clear };
}

// Backend acks the WS emit, but if the socket is wedged we don't want the
// modal to stall forever — spec calls for a 3s ack timeout that surfaces a
// "network slow, retry" toast.
function withTimeout(promise: Promise<OfferAck>, ms: number): Promise<OfferAck> {
  return Promise.race<OfferAck>([
    promise,
    new Promise<OfferAck>((resolve) =>
      setTimeout(
        () => resolve({ ok: false, error: { code: "ALREADY_FINALIZED" } }),
        ms
      )
    )
  ]);
}
