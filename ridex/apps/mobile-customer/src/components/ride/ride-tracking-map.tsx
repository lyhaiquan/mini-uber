import { decodePolyline5, type RideDetailResponse } from "@ridex/shared-types";
import { MapView, type MapMarkerData } from "@ridex/ui-mobile";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import type { DriverPosition } from "../../hooks/use-ride";
import { env } from "../../lib/env";

void React;

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

  const route = React.useMemo<GeoJSON.LineString>(() => {
    const encoded = ride.pricing?.routePolyline ?? null;
    if (encoded === null || encoded.length === 0) {
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

  const initialCenter =
    ride.status === "IN_PROGRESS"
      ? { lat: ride.destination.lat, lng: ride.destination.lng }
      : { lat: ride.pickup.lat, lng: ride.pickup.lng };

  return (
    <View style={styles.container}>
      <MapView
        token={env.mapboxToken ?? ""}
        initialCenter={initialCenter}
        initialZoom={13}
        markers={markers}
        route={route}
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 380, width: "100%", overflow: "hidden", borderRadius: 8 },
  map: { width: "100%", height: "100%" }
});
