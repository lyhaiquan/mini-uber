import {
  Button,
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
import * as Linking from "expo-linking";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { env } from "../../src/lib/env";

export default function HomeTab() {
  const permission = useLocationPermission();
  const mapboxToken = env.mapboxToken ?? "";

  if (!mapboxToken) {
    return (
      <Screen>
        <Text variant="h2">Cần Mapbox token</Text>
        <Text variant="body">
          Đặt <Text variant="body">extra.mapboxToken</Text> trong app.json để bật map.
        </Text>
      </Screen>
    );
  }

  if (permission.isLoading || permission.status === "undetermined") {
    return (
      <Screen>
        <Text variant="h2">Bản đồ RideX</Text>
        <Text variant="body">Cần quyền vị trí để hiển thị xe gần bạn.</Text>
        <Button
          className="mt-3 self-start"
          loading={permission.isLoading}
          onPress={() => {
            void permission.request();
          }}
        >
          Cho phép vị trí
        </Button>
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
        <Button className="mt-3 self-start" onPress={() => void Linking.openSettings()}>
          Mở cài đặt
        </Button>
      </Screen>
    );
  }

  return <CustomerMap mapboxToken={mapboxToken} />;
}

function CustomerMap({ mapboxToken }: { mapboxToken: string }) {
  const { coords, isFallback } = useCurrentLocation({ autoRequest: false });
  const [pickup, setPickup] = React.useState<LatLng | null>(null);
  const [destination, setDestination] = React.useState<LatLng | null>(null);

  const markers = React.useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    if (pickup) out.push({ id: "pickup", coord: pickup, variant: "pickup" });
    if (destination)
      out.push({ id: "destination", coord: destination, variant: "destination" });
    return out;
  }, [pickup, destination]);

  return (
    <View style={styles.container}>
      <View style={styles.searchOverlay}>
        <LocationSearch
          token={mapboxToken}
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
        token={mapboxToken}
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
  map: { flex: 1 }
});
