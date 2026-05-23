import Mapbox, { Camera, MapView as RNMapView } from "@rnmapbox/maps";
import * as React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { MapMarker } from "./map-marker";
import { MapRoute } from "./map-route";
import { SAIGON_FALLBACK, type LatLng, type MapMarkerData } from "./types";

const DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";
let tokenSet = false;

function ensureToken(token: string) {
  if (tokenSet) return;
  Mapbox.setAccessToken(token);
  Mapbox.setTelemetryEnabled(false);
  tokenSet = true;
}

export interface MapViewProps {
  token: string;
  initialCenter?: LatLng;
  initialZoom?: number;
  markers?: MapMarkerData[];
  route?: GeoJSON.LineString;
  onMapClick?: (point: LatLng) => void;
  followUserLocation?: boolean;
  styleUrl?: string;
  style?: StyleProp<ViewStyle>;
}

export function MapView({
  token,
  initialCenter = SAIGON_FALLBACK,
  initialZoom = 13,
  markers,
  route,
  onMapClick,
  followUserLocation,
  styleUrl = DEFAULT_STYLE,
  style
}: MapViewProps) {
  React.useEffect(() => {
    if (token) ensureToken(token);
  }, [token]);

  const handlePress = React.useCallback(
    (feature: GeoJSON.Feature) => {
      if (!onMapClick) return;
      if (feature.geometry.type !== "Point") return;
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      onMapClick({ lat, lng });
    },
    [onMapClick]
  );

  return (
    <View style={[styles.container, style]}>
      <RNMapView
        style={styles.map}
        styleURL={styleUrl}
        onPress={onMapClick ? handlePress : undefined}
      >
        <Camera
          defaultSettings={{
            centerCoordinate: [initialCenter.lng, initialCenter.lat],
            zoomLevel: initialZoom
          }}
          followUserLocation={followUserLocation ?? false}
          followZoomLevel={initialZoom}
        />
        {markers?.map((m) => (
          <MapMarker key={m.id} marker={m} />
        ))}
        {route ? <MapRoute geometry={route} /> : null}
      </RNMapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320 },
  map: { flex: 1 }
});
