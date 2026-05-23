import type BottomSheet from "@gorhom/bottom-sheet";
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
import { useRouter } from "expo-router";
import * as React from "react";
import { Alert, StyleSheet, View } from "react-native";

import { ConfirmButton } from "../../src/components/ride/confirm-button";
import { FareEstimateCard } from "../../src/components/ride/fare-estimate-card";
import { PickupDestinationSheet } from "../../src/components/ride/pickup-destination-sheet";
import { useCreateRide } from "../../src/hooks/use-create-ride";
import { useRideQuote } from "../../src/hooks/use-ride-quote";
import { env } from "../../src/lib/env";
import { usePickupDestinationStore } from "../../src/store/pickup-destination-store";

void LocationSearch;

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
  const router = useRouter();
  const { coords, isFallback } = useCurrentLocation({ autoRequest: false });
  const sheetRef = React.useRef<BottomSheet>(null);
  const {
    pickup,
    destination,
    pickupAddress,
    destinationAddress,
    setPickup,
    setDestination,
    reset
  } = usePickupDestinationStore();
  const quote = useRideQuote({ pickup, destination });
  const createRide = useCreateRide();

  const markers = React.useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    if (pickup) out.push({ id: "pickup", coord: pickup, variant: "pickup" });
    if (destination)
      out.push({ id: "destination", coord: destination, variant: "destination" });
    return out;
  }, [pickup, destination]);

  const handleConfirm = React.useCallback(() => {
    if (!pickup || !destination) return;
    createRide.mutate(
      {
        pickup: {
          lat: pickup.lat,
          lng: pickup.lng,
          address:
            pickupAddress ?? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`
        },
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          address:
            destinationAddress ??
            `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`
        }
      },
      {
        onSuccess: (ride) => {
          reset();
          router.push(`/rides/${ride.id}`);
        },
        onError: (err) => {
          const isAlreadyActive =
            err instanceof Error && /RIDE_ALREADY_ACTIVE/.test(err.message);
          Alert.alert(
            "Đặt xe thất bại",
            isAlreadyActive ? "Bạn đang có chuyến đi." : "Vui lòng thử lại."
          );
        }
      }
    );
  }, [pickup, destination, pickupAddress, destinationAddress, createRide, reset, router]);

  const handleMapClick = React.useCallback(
    (point: LatLng) => {
      if (!pickup) setPickup(point);
      else if (!destination) setDestination(point);
    },
    [pickup, destination, setPickup, setDestination]
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchOverlay}>
        <Button onPress={() => sheetRef.current?.expand()}>
          {destination ? "Đổi điểm" : "Bạn đi đâu?"}
        </Button>
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
        onMapClick={handleMapClick}
        style={styles.map}
      />
      {pickup && destination ? (
        <View style={styles.bottomOverlay}>
          <FareEstimateCard quote={quote.data} loading={quote.isLoading} />
          <ConfirmButton
            totalVnd={quote.data?.totalVnd ?? null}
            loading={createRide.isPending}
            onPress={handleConfirm}
          />
        </View>
      ) : null}
      <PickupDestinationSheet
        ref={sheetRef}
        mapboxToken={mapboxToken}
        onComplete={() => sheetRef.current?.close()}
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
  bottomOverlay: {
    position: "absolute",
    bottom: 24,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 10
  },
  map: { flex: 1 }
});
