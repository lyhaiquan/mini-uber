import {
  acceptOffer,
  rejectOffer,
  RIDE_OFFER_CANCELLED_EVENT,
  RIDE_OFFER_RECEIVED_EVENT,
  withAckTimeout,
  type OfferAck,
  type OfferCancelledPayload,
  type OfferReceivedPayload
} from "@ridex/socket-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { driversApi } from "../lib/api";
import { getDriverSocket } from "../lib/socket";

export const offerKeys = {
  all: ["offers"] as const,
  current: () => [...offerKeys.all, "current"] as const
};

const REST_POLL_INTERVAL_MS = 3_000;

export interface UseDriverOfferResult {
  offer: OfferReceivedPayload | null;
  accept: (offerId: string) => Promise<OfferAck>;
  reject: (offerId: string, reason?: string) => Promise<OfferAck>;
  clear: () => void;
}

// Mirror of the web hook; behaviour is identical so the driver code paths
// stay symmetric. REST poll runs only while no offer is in hand so we
// don't double-charge bandwidth with the WS push.
export function useDriverOffer(opts: { enabled: boolean }): UseDriverOfferResult {
  const { enabled } = opts;
  const qc = useQueryClient();
  const [offer, setOffer] = React.useState<OfferReceivedPayload | null>(null);

  useQuery({
    queryKey: offerKeys.current(),
    queryFn: () => driversApi.getCurrentOffer(),
    enabled: enabled && offer === null,
    refetchInterval: REST_POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
    select: (data) => {
      if (data !== null && offer === null) {
        setOffer(data);
      }
      return data;
    }
  });

  React.useEffect(() => {
    if (!enabled) {
      // Mirror the web hook: drop offer + polled cache when disabled so a
      // stale OfferScreen can't outlive the online toggle / ride assignment.
      setOffer(null);
      void qc.invalidateQueries({ queryKey: offerKeys.current() });
      return;
    }
    const socket = getDriverSocket();
    if (!socket.connected) socket.connect();

    const onReceived = (payload: OfferReceivedPayload) => {
      setOffer(payload);
      void qc.invalidateQueries({ queryKey: offerKeys.current() });
    };
    const onCancelled = (payload: OfferCancelledPayload) => {
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
    const ack = await withAckTimeout(acceptOffer(socket, offerId), 3_000);
    if (ack.ok) {
      setOffer(null);
    }
    return ack;
  }, []);

  const reject = React.useCallback(async (offerId: string, reason?: string) => {
    const socket = getDriverSocket();
    const ack = await withAckTimeout(rejectOffer(socket, offerId, reason), 3_000);
    setOffer(null);
    return ack;
  }, []);

  const clear = React.useCallback(() => setOffer(null), []);

  return { offer, accept, reject, clear };
}
