import {
  MapView,
  SAIGON_FALLBACK,
  Screen,
  Text,
  useCurrentLocation,
  useLocationPermission,
  type MapMarkerData
} from "@ridex/ui-mobile";
import Constants from "expo-constants";
import * as React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

const MAPBOX_TOKEN = (Constants.expoConfig?.extra?.mapboxToken as string | undefined) ?? "";

export default function HomeTab() {
  const permission = useLocationPermission();
  const { coords, isFallback } = useCurrentLocation();

  const markers = React.useMemo<MapMarkerData[]>(
    () => [{ id: "self", coord: coords, variant: "self", heading: 0 }],
    [coords]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <Screen>
        <Text variant="h2">Cần Mapbox token</Text>
        <Text variant="body">
          Đặt extra.mapboxToken trong app.json để bật map.
        </Text>
      </Screen>
    );
  }

  if (permission.status === "denied" || permission.status === "restricted") {
    return (
      <Screen>
        <Text variant="h2">Cần quyền vị trí</Text>
        <Text variant="body">
          Tài xế cần cấp quyền vị trí để cập nhật xe lên hệ thống.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} style={styles.cta}>
          <Text variant="body" style={{ color: "white" }}>
            Mở cài đặt
          </Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        {isFallback ? (
          <Text variant="caption" style={{ color: "#64748b" }}>
            Đang dùng vị trí mặc định
          </Text>
        ) : (
          <Text variant="caption">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        )}
      </View>
      <MapView
        token={MAPBOX_TOKEN}
        initialCenter={coords ?? SAIGON_FALLBACK}
        initialZoom={14}
        markers={markers}
        followUserLocation
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.85)",
    padding: 10,
    borderRadius: 8
  },
  map: { flex: 1 },
  cta: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#0a84ff",
    borderRadius: 8,
    alignSelf: "flex-start"
  }
});
