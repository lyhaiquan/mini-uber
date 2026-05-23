import { Screen, Text } from "@ridex/ui-mobile";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { ReceiptSheet } from "../../src/components/ride/receipt-sheet";
import { RideTrackingMap } from "../../src/components/ride/ride-tracking-map";
import {
  CUSTOMER_CANCELABLE_STATUSES,
  StatusCard
} from "../../src/components/ride/status-card";
import { useCancelRide, useRide, useRideWs } from "../../src/hooks/use-ride";

void React;

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = id ?? "";
  const router = useRouter();

  const { driverPosition, connected } = useRideWs(rideId);
  const rideQuery = useRide(rideId, { wsConnected: connected });
  const cancel = useCancelRide(rideId);
  const [receiptDismissed, setReceiptDismissed] = React.useState(false);

  const ride = rideQuery.data ?? null;

  React.useEffect(() => {
    if (rideQuery.isError) {
      const err = rideQuery.error;
      if (err instanceof Error && /RIDE_NOT_FOUND|404/.test(err.message)) {
        router.replace("/(tabs)" as never);
      }
    }
  }, [rideQuery.isError, rideQuery.error, router]);

  if (rideQuery.isLoading || ride === null) {
    return (
      <Screen>
        <Text variant="body">Đang tải chuyến đi...</Text>
      </Screen>
    );
  }

  const cancelable = CUSTOMER_CANCELABLE_STATUSES.includes(ride.status);
  const showReceipt = ride.status === "COMPLETED" && !receiptDismissed;

  const onRequestCancel = () => {
    Alert.alert("Hủy chuyến?", "Bạn có chắc muốn hủy chuyến đi này?", [
      { text: "Không", style: "cancel" },
      {
        text: "Hủy chuyến",
        style: "destructive",
        onPress: () =>
          cancel.mutate(undefined, {
            onSuccess: () => router.replace("/(tabs)" as never),
            onError: (err) => {
              Alert.alert(
                "Không hủy được",
                err instanceof Error ? err.message : "Vui lòng thử lại."
              );
            }
          })
      }
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="h2">Chuyến đi</Text>
        <View style={styles.mapWrap}>
          <RideTrackingMap ride={ride} driverPosition={driverPosition} />
        </View>
        <StatusCard
          status={ride.status}
          driver={ride.driver}
          wsConnected={connected}
          cancelable={cancelable}
          cancelPending={cancel.isPending}
          onRequestCancel={onRequestCancel}
        />
      </ScrollView>
      <ReceiptSheet
        open={showReceipt}
        pricing={ride.pricing}
        onClose={() => {
          setReceiptDismissed(true);
          router.replace("/(tabs)" as never);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 12 },
  mapWrap: { width: "100%" }
});
