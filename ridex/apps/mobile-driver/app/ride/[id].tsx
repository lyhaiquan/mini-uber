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

  const lastPricingRef = React.useRef<{ totalVnd: number } | null>(null);
  React.useEffect(() => {
    if (ride !== null && ride.pricing !== null) {
      lastPricingRef.current = { totalVnd: ride.pricing.totalVnd };
    }
  }, [ride]);

  const completedShown = React.useRef(false);
  const [completing, setCompleting] = React.useState(false);
  React.useEffect(() => {
    const updated = transition.data;
    if (updated === undefined) return;
    if (updated.status !== "COMPLETED") return;
    if (completedShown.current) return;

    completedShown.current = true;
    setCompleting(true);

    const pricing = lastPricingRef.current;
    const payout = pricing !== null ? Math.round(pricing.totalVnd * 0.8) : null;
    Alert.alert(
      "Hoàn thành",
      payout !== null
        ? `Ước tính thu nhập: ${vnd.format(payout)} ₫`
        : "Chuyến đã hoàn thành.",
      [{ text: "Tiếp tục", onPress: () => router.replace("/(tabs)/home" as never) }]
    );
  }, [transition.data, router]);

  if (completing) {
    return (
      <Screen>
        <Text variant="body" accessibilityLabel="driver-completing-state">
          Đang hoàn tất chuyến...
        </Text>
      </Screen>
    );
  }

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
        <Text variant="body" accessibilityLabel="driver-empty-state">
          Bạn đang không có chuyến nào.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="h2" accessibilityLabel="driver-current-ride-screen">
          Chuyến hiện tại
        </Text>
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
