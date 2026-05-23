"use client";

import { decodePolyline5, type RideDetailResponse } from "@ridex/shared-types";
import { MapView, type MapMarkerData } from "@ridex/ui-web";
import * as React from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export interface InRideMapProps {
  ride: RideDetailResponse;
}

// Driver-side map for the in-ride screen. Pre-IN_PROGRESS the camera frames
// the pickup so the driver knows where to head; post-IN_PROGRESS it
// shifts to the destination to track progress toward drop-off.
export function InRideMap({ ride }: InRideMapProps) {
  const markers = React.useMemo<MapMarkerData[]>(
    () => [
      {
        id: "pickup",
        coord: { lat: ride.pickup.lat, lng: ride.pickup.lng },
        variant: "pickup",
        label: "Điểm đón"
      },
      {
        id: "destination",
        coord: { lat: ride.destination.lat, lng: ride.destination.lng },
        variant: "destination",
        label: "Điểm đến"
      }
    ],
    [ride.pickup, ride.destination]
  );

  const route = React.useMemo<GeoJSON.LineString>(() => {
    const encoded = ride.pricing?.routePolyline ?? null;
    if (encoded === null || encoded.length === 0) {
      // No polyline (OSRM low-confidence) → straight line gives the driver
      // at least the corridor direction.
      return {
        type: "LineString",
        coordinates: [
          [ride.pickup.lng, ride.pickup.lat],
          [ride.destination.lng, ride.destination.lat]
        ]
      };
    }
    const points = decodePolyline5(encoded);
    return { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) };
  }, [ride.pickup, ride.destination, ride.pricing]);

  const center =
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
        initialCenter={center}
        initialZoom={13}
        markers={markers}
        route={route}
      />
    </div>
  );
}
