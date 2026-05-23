import { PointAnnotation } from "@rnmapbox/maps";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MapMarkerData } from "./types";

export interface MapMarkerProps {
  marker: MapMarkerData;
}

const variantStyle = {
  pickup: { backgroundColor: "#0a84ff", borderRadius: 999 },
  destination: { backgroundColor: "#000000", borderRadius: 2 },
  self: { backgroundColor: "#0a84ff", borderRadius: 999 }
} as const;

export function MapMarker({ marker }: MapMarkerProps) {
  const variant = marker.variant ?? "pickup";
  return (
    <PointAnnotation
      id={marker.id}
      coordinate={[marker.coord.lng, marker.coord.lat]}
    >
      <View style={[styles.dot, variantStyle[variant]]}>
        {variant === "self" ? (
          <Text style={{ color: "white", fontSize: 12 }}>▲</Text>
        ) : null}
      </View>
    </PointAnnotation>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center"
  }
});
