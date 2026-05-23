import {
  Button,
  MapView,
  SAIGON_FALLBACK,
  Screen,
  Text,
  useCurrentLocation,
  useLocationPermission,
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
          Đặt extra.mapboxToken trong app.json để bật map.
        </Text>
      </Screen>
    );
  }

  if (permission.isLoading || permission.status === "undetermined") {
    return (
      <Screen>
        <Text variant="h2">Bản đồ tài xế</Text>
        <Text variant="body">Cho phép vị trí để hiển thị xe của bạn.</Text>
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
          Tài xế cần cấp quyền vị trí để cập nhật xe lên hệ thống.
        </Text>
        <Button className="mt-3 self-start" onPress={() => void Linking.openSettings()}>
          Mở cài đặt
        </Button>
      </Screen>
    );
  }

  return <DriverMap mapboxToken={mapboxToken} />;
}

function DriverMap({ mapboxToken }: { mapboxToken: string }) {
  const { coords, isFallback } = useCurrentLocation({ autoRequest: false });

  const markers = React.useMemo<MapMarkerData[]>(
    () => [{ id: "self", coord: coords, variant: "self", heading: 0 }],
    [coords]
  );

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
        token={mapboxToken}
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
  map: { flex: 1 }
});
