import {
  LocationSearch,
  MapView,
  SAIGON_FALLBACK,
  Screen,
  Text,
  useCurrentLocation,
  useLocationPermission,
  type LatLng,
  type MapMarkerData
} from "@ridex/ui-mobile";
import Constants from "expo-constants";
import * as React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

const MAPBOX_TOKEN = (Constants.expoConfig?.extra?.mapboxToken as string | undefined) ?? "";

export default function HomeTab() {
  const permission = useLocationPermission();
  const { coords, isFallback } = useCurrentLocation();
  const [pickup, setPickup] = React.useState<LatLng | null>(null);
  const [destination, setDestination] = React.useState<LatLng | null>(null);

  const markers = React.useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    if (pickup) out.push({ id: "pickup", coord: pickup, variant: "pickup" });
    if (destination)
      out.push({ id: "destination", coord: destination, variant: "destination" });
    return out;
  }, [pickup, destination]);

  if (!MAPBOX_TOKEN) {
    return (
      <Screen>
        <Text variant="h2">Cần Mapbox token</Text>
        <Text variant="body">
          Đặt <Text variant="body">extra.mapboxToken</Text> trong app.json để bật map.
        </Text>
      </Screen>
    );
  }

  if (permission.status === "denied" || permission.status === "restricted") {
    return (
      <Screen>
        <Text variant="h2">Cần quyền vị trí</Text>
        <Text variant="body">
          RideX cần quyền vị trí để tìm tài xế. Mở cài đặt để cấp quyền.
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
      <View style={styles.searchOverlay}>
        <LocationSearch
          token={MAPBOX_TOKEN}
          placeholder="Tìm điểm đón hoặc điểm đến..."
          onSelect={(r) => {
            if (!pickup) setPickup(r.coord);
            else if (!destination) setDestination(r.coord);
          }}
        />
        {isFallback ? (
          <Text variant="caption" style={{ color: "#64748b", marginTop: 4 }}>
            Đang dùng vị trí mặc định Sài Gòn
          </Text>
        ) : null}
      </View>
      <MapView
        token={MAPBOX_TOKEN}
        initialCenter={coords ?? SAIGON_FALLBACK}
        markers={markers}
        onMapClick={(point) => {
          if (!pickup) setPickup(point);
          else if (!destination) setDestination(point);
        }}
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10
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
