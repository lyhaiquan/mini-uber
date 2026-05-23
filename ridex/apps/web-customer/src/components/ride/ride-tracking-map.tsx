"use client";

import { MapView, type MapMarkerData } from "@ridex/ui-web";
import { decodePolyline5, type RideDetailResponse } from "@ridex/shared-types";
import * as React from "react";

import type { DriverPosition } from "@/hooks/use-ride";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export interface RideTrackingMapProps {
  ride: RideDetailResponse;
  driverPosition: DriverPosition | null;
}

export function RideTrackingMap({ ride, driverPosition }: RideTrackingMapProps) {
  const markers = React.useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [
      {
        id: "pickup",
        coord: { lat: ride.pickup.lat, lng: ride.pickup.lng },
        variant: "pickup",
        label: "Đón"
      },
      {
        id: "destination",
        coord: { lat: ride.destination.lat, lng: ride.destination.lng },
        variant: "destination",
        label: "Đến"
      }
    ];
    if (driverPosition !== null) {
      out.push({
        id: "driver",
        coord: { lat: driverPosition.lat, lng: driverPosition.lng },
        variant: "self",
        heading: driverPosition.heading ?? 0,
        label: "Tài xế"
      });
    }
    return out;
  }, [ride.pickup, ride.destination, driverPosition]);

  const route = React.useMemo<GeoJSON.LineString | undefined>(() => {
    const encoded = ride.pricing?.routePolyline;
    if (encoded === null || encoded === undefined || encoded.length === 0) {
      // OSRM may not have returned a polyline (low-confidence fallback). Draw
      // a straight line between pickup and destination so the customer at
      // least sees the corridor.
      return {
        type: "LineString",
        coordinates: [
          [ride.pickup.lng, ride.pickup.lat],
          [ride.destination.lng, ride.destination.lat]
        ]
      };
    }
    const points = decodePolyline5(encoded);
    return {
      type: "LineString",
      coordinates: points.map((p) => [p.lng, p.lat])
    };
  }, [ride.pickup, ride.destination, ride.pricing]);

  // Camera focus shifts with ride state: while ACCEPTED we want the customer
  // to watch the driver approach pickup; in IN_PROGRESS we follow them toward
  // the destination. Initial center is the pickup so the map mounts on the
  // user's starting location.
  const initialCenter =
    ride.status === "IN_PROGRESS"
      ? { lat: ride.destination.lat, lng: ride.destination.lng }
      : { lat: ride.pickup.lat, lng: ride.pickup.lng };

  if (MAPBOX_TOKEN.length === 0) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Cần đặt biến môi trường <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> để hiển thị bản đồ.
      </div>
    );
  }

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
      <MapView
        token={MAPBOX_TOKEN}
        initialCenter={initialCenter}
        initialZoom={13}
        markers={markers}
        route={route}
      />
    </div>
  );
}
