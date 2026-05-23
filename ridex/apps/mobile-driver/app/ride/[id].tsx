import { Screen, Text } from "@ridex/ui-mobile";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";

import { InRideCard } from "../../src/components/driver/in-ride-card";
import { InRideMap } from "../../src/components/driver/in-ride-map";
import {
  useDriverActiveRide,
  useRideTransition
} from "../../src/hooks/use-active-ride";

void React;

const vnd = new Intl.NumberFormat("vi-VN");

export default function DriverRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = id ?? "";
  const router = useRouter();

  const activeQuery = useDriverActiveRide();
  const transition = useRideTransition(rideId);

  const ride = activeQuery.data ?? null;
  const matches = ride !== null && ride.id === rideId;

  // Completion toast → bounce home. Once-per-ride so re-renders don't spam.
  const completedShown = React.useRef(false);
  React.useEffect(() => {
    if (ride === null) return;
    if (ride.status !== "COMPLETED") return;
    if (completedShown.current) return;
    completedShown.current = true;
    const payout =
      ride.pricing !== null ? Math.round(ride.pricing.totalVnd * 0.8) : null;
    Alert.alert(
      "Hoàn thành",
      payout !== null
        ? `Ước tính thu nhập: ${vnd.format(payout)} ₫`
        : "Chuyến đã hoàn thành.",
      [{ text: "Tiếp tục", onPress: () => router.replace("/(tabs)/home" as never) }]
    );
  }, [ride, router]);

  if (activeQuery.isLoading) {
    return (
      <Screen>
        <Text variant="body">Đang tải...</Text>
      </Screen>
    );
  }

  if (ride === null || !matches) {
    return (
      <Screen>
        <Text variant="body">Bạn đang không có chuyến nào.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="h2">Chuyến hiện tại</Text>
        <InRideMap ride={ride} />
        <InRideCard
          ride={ride}
          transitionPending={transition.isPending}
          onTransition={(next) => {
            transition.mutate(
              { toStatus: next },
              {
                onError: (err) => {
                  Alert.alert(
                    "Không thực hiện được",
                    err instanceof Error ? err.message : "Vui lòng thử lại."
                  );
                }
              }
            );
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 12 }
});
