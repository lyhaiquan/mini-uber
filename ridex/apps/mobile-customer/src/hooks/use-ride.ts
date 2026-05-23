import {
  RIDE_DRIVER_LOCATION_EVENT,
  RIDE_STATUS_CHANGED_EVENT,
  subscribeRide,
  unsubscribeRide,
  type RideDriverLocationPayload,
  type RideStatusChangedPayload
} from "@ridex/socket-client";
import type { RideDetailResponse, TransitionRideDto } from "@ridex/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { ridesApi } from "../lib/api";
import { getTrackingSocket } from "../lib/socket";

export const rideKeys = {
  all: ["rides"] as const,
  active: () => [...rideKeys.all, "active"] as const,
  detail: (rideId: string) => [...rideKeys.all, rideId] as const
};

const POLLING_INTERVAL_MS = 5_000;
const DRIVER_LOCATION_STALE_MS = 10_000;

export function useRide(rideId: string, opts?: { wsConnected: boolean }) {
  return useQuery({
    queryKey: rideKeys.detail(rideId),
    queryFn: () => ridesApi.getRide(rideId),
    enabled: rideId.length > 0,
    refetchInterval: opts?.wsConnected === false ? POLLING_INTERVAL_MS : false,
    refetchOnWindowFocus: false,
    staleTime: 1_000
  });
}

export interface DriverPosition {
  lat: number;
  lng: number;
  heading: number | null;
  recordedAt: string;
}

export interface UseRideWsResult {
  driverPosition: DriverPosition | null;
  connected: boolean;
  isPositionStale: boolean;
}

export function useRideWs(rideId: string): UseRideWsResult {
  const qc = useQueryClient();
  const [driverPosition, setDriverPosition] = React.useState<DriverPosition | null>(null);
  const [connected, setConnected] = React.useState<boolean>(true);
  const [isPositionStale, setIsPositionStale] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (rideId.length === 0) return;
    const socket = getTrackingSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) {
      setConnected(true);
    } else {
      socket.connect();
    }

    const onLocation = (payload: RideDriverLocationPayload) => {
      if (payload.rideId !== rideId) return;
      setDriverPosition({
        lat: payload.lat,
        lng: payload.lng,
        heading: payload.heading,
        recordedAt: payload.recordedAt
      });
      setIsPositionStale(false);
    };
    const onStatus = (payload: RideStatusChangedPayload) => {
      if (payload.rideId !== rideId) return;
      qc.setQueryData<RideDetailResponse | undefined>(
        rideKeys.detail(rideId),
        (old) => (old === undefined ? old : { ...old, status: payload.toStatus })
      );
      void qc.invalidateQueries({ queryKey: rideKeys.detail(rideId) });
    };
    socket.on(RIDE_DRIVER_LOCATION_EVENT, onLocation);
    socket.on(RIDE_STATUS_CHANGED_EVENT, onStatus);

    let cancelled = false;
    void subscribeRide(socket, rideId).then((ack) => {
      if (cancelled) return;
      if (ack.ok === false) {
        setConnected(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeRide(socket, rideId);
      socket.off(RIDE_DRIVER_LOCATION_EVENT, onLocation);
      socket.off(RIDE_STATUS_CHANGED_EVENT, onStatus);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [rideId, qc]);

  React.useEffect(() => {
    if (driverPosition === null) return;
    const id = setTimeout(() => setIsPositionStale(true), DRIVER_LOCATION_STALE_MS);
    return () => clearTimeout(id);
  }, [driverPosition]);

  return { driverPosition, connected, isPositionStale };
}

export function useCancelRide(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const dto: TransitionRideDto = {
        toStatus: "CANCELLED",
        reason: "customer_cancelled"
      };
      return ridesApi.transitionRide(rideId, dto);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rideKeys.detail(rideId) });
      void qc.invalidateQueries({ queryKey: rideKeys.active() });
    }
  });
}
