"use client";

import type { RideDetailResponse } from "@ridex/shared-types";
import {
  RIDE_DRIVER_LOCATION_EVENT,
  RIDE_STATUS_CHANGED_EVENT,
  subscribeRide,
  unsubscribeRide,
  type RideDriverLocationPayload,
  type RideStatusChangedPayload
} from "@ridex/socket-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { rideKeys } from "./use-rides";

import { ridesApi } from "@/lib/api";
import { getTrackingSocket } from "@/lib/socket";


// Polling fallback when the socket disconnects. 5s matches the task spec; we
// keep the query alive but stale so re-focus doesn't double-fetch.
const POLLING_INTERVAL_MS = 5_000;
const DRIVER_LOCATION_STALE_MS = 10_000;

export function useRide(rideId: string, opts?: { wsConnected: boolean }) {
  return useQuery({
    queryKey: rideKeys.detail(rideId),
    queryFn: () => ridesApi.getRide(rideId),
    enabled: rideId.length > 0,
    // Fall back to polling whenever the WS pipe is down. Once the socket
    // reconnects this drops back to manual refetch.
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
      // Patch the cache so the screen reflects the new status without waiting
      // for the next REST poll. Other fields stay as-is; the next refetch will
      // pick up timestamps and driver assignment.
      qc.setQueryData<RideDetailResponse | undefined>(
        rideKeys.detail(rideId),
        (old) => (old === undefined ? old : { ...old, status: payload.toStatus })
      );
      // For ACCEPTED/COMPLETED/CANCELLED we also want the full DTO (driver
      // identity, completedAt, etc.). Fire a refetch in the background.
      void qc.invalidateQueries({ queryKey: rideKeys.detail(rideId) });
    };
    socket.on(RIDE_DRIVER_LOCATION_EVENT, onLocation);
    socket.on(RIDE_STATUS_CHANGED_EVENT, onStatus);

    let cancelled = false;
    void subscribeRide(socket, rideId).then((ack) => {
      if (cancelled) return;
      if (ack.ok === false) {
        // Failed subscriptions are typically RIDE_FORBIDDEN_ACCESS (different
        // customer) or RIDE_NOT_FOUND. Either way, polling fallback is what
        // the user gets — no toast here; the page-level error handles it.
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

  // Mark the marker as "waiting for fresh fix" if no update arrives for 10s.
  React.useEffect(() => {
    if (driverPosition === null) return;
    const id = window.setTimeout(() => setIsPositionStale(true), DRIVER_LOCATION_STALE_MS);
    return () => window.clearTimeout(id);
  }, [driverPosition]);

  return { driverPosition, connected, isPositionStale };
}

export function useCancelRide(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      ridesApi.transitionRide(rideId, {
        toStatus: "CANCELLED",
        reason: "customer_cancelled"
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rideKeys.detail(rideId) });
      void qc.invalidateQueries({ queryKey: rideKeys.active() });
    }
  });
}
