import { decodePolyline5, type RideDetailResponse } from "@ridex/shared-types";
import { MapView, type MapMarkerData } from "@ridex/ui-mobile";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { env } from "../../lib/env";

void React;

export interface InRideMapProps {
  ride: RideDetailResponse;
}

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

  return (
    <View style={styles.container}>
      <MapView
        token={env.mapboxToken ?? ""}
        initialCenter={center}
        initialZoom={13}
        markers={markers}
        route={route}
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 360, borderRadius: 8, overflow: "hidden" },
  map: { width: "100%", height: "100%" }
});
