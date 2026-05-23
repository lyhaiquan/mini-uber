import {
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
import {
  Alert,
  AppState,
  StyleSheet,
  View,
  type AppStateStatus
} from "react-native";

import { OnlineToggle } from "../../src/components/driver/online-toggle";
import { PermissionBanner } from "../../src/components/driver/permission-banner";
import { StatusPill } from "../../src/components/driver/status-pill";
import {
  useDriverAvailability,
  useGoOffline,
  useGoOnline
} from "../../src/hooks/use-driver-status";
import { useLocationStream } from "../../src/hooks/use-location-stream";
import { env } from "../../src/lib/env";

export default function HomeTab() {
  const permission = useLocationPermission();
  const mapboxToken = env.mapboxToken ?? "";
  const availability = useDriverAvailability();
  const goOnline = useGoOnline();
  const goOffline = useGoOffline();
  const isOnline = availability.data?.isOnline ?? false;

  const stream = useLocationStream({
    enabled: isOnline,
    onPermissionDenied: () => {
      Alert.alert(
        "Mất quyền vị trí",
        "Đang chuyển tài xế sang offline vì không truy cập được vị trí."
      );
      goOffline.mutate();
    }
  });

  // AppState listener: when the app moves to background per spec, send a
  // best-effort offline so the server doesn't keep the driver in the pool
  // while their device is suspended (foreground-only stream).
  React.useEffect(() => {
    if (!isOnline) return;
    const handler = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        goOffline.mutate();
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, [isOnline, goOffline]);

  if (!mapboxToken) {
    return (
      <Screen>
        <Text variant="h2">Cần Mapbox token</Text>
        <Text variant="body">Đặt extra.mapboxToken trong app.json.</Text>
      </Screen>
    );
  }

  if (permission.isLoading || permission.status === "undetermined") {
    return (
      <Screen>
        <Text variant="h2">Cần quyền vị trí</Text>
        <PermissionBanner />
      </Screen>
    );
  }

  if (permission.status === "denied" || permission.status === "restricted") {
    return (
      <Screen>
        <PermissionBanner />
      </Screen>
    );
  }

  const onGo = () => {
    if (stream.permissionDenied) {
      void Linking.openSettings();
      return;
    }
    goOnline.mutate(undefined, {
      onError: (err) => {
        Alert.alert(
          "Không bật được online",
          err instanceof Error ? err.message : "Vui lòng thử lại."
        );
      }
    });
  };

  const onStop = () => {
    Alert.alert("Tắt trạng thái online?", "Bạn sẽ ngừng nhận chuyến.", [
      { text: "Không", style: "cancel" },
      {
        text: "Tắt",
        style: "destructive",
        onPress: () => {
          goOffline.mutate(undefined, {
            onError: (err) => {
              Alert.alert(
                "Không tắt được",
                err instanceof Error ? err.message : "Vui lòng thử lại."
              );
            }
          });
        }
      }
    ]);
  };

  const toggleState: "online" | "offline" | "going-online" | "going-offline" =
    goOnline.isPending
      ? "going-online"
      : goOffline.isPending
        ? "going-offline"
        : isOnline
          ? "online"
          : "offline";
  const pillState: "online" | "offline" | "loading" = availability.isLoading
    ? "loading"
    : isOnline
      ? "online"
      : "offline";

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h2">Trạm điều phối</Text>
        <StatusPill state={pillState} />
      </View>
      <Text variant="caption">Hôm nay: 0 ₫ · 0 chuyến</Text>
      <View style={styles.toggleWrap}>
        <OnlineToggle
          state={toggleState}
          disabled={stream.permissionDenied}
          onGo={onGo}
          onStop={onStop}
        />
        <Text variant="caption">
          {isOnline ? "Đang nhận chuyến..." : "Tap để bắt đầu nhận chuyến"}
        </Text>
      </View>
      <View style={styles.mapWrap}>
        <DriverMap mapboxToken={mapboxToken} />
      </View>
    </Screen>
  );
}

function DriverMap({ mapboxToken }: { mapboxToken: string }) {
  const { coords } = useCurrentLocation({ autoRequest: false });
  const markers = React.useMemo<MapMarkerData[]>(
    () => [{ id: "self", coord: coords, variant: "self", heading: 0 }],
    [coords]
  );
  return (
    <MapView
      token={mapboxToken}
      initialCenter={coords ?? SAIGON_FALLBACK}
      initialZoom={14}
      markers={markers}
      followUserLocation
      style={styles.map}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleWrap: { alignItems: "center", gap: 8, marginVertical: 12 },
  mapWrap: { flex: 1, marginTop: 8, borderRadius: 8, overflow: "hidden" },
  map: { width: "100%", height: 320 }
});
