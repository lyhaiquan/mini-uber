import { Button, Card, Text } from "@ridex/ui-mobile";
import type { DriverSummary, RideStatus } from "@ridex/shared-types";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { StateStepper } from "./state-stepper";

void React;

// Customer-side cancel matches the web rules: free cancel before driver
// arrives. After DRIVER_ARRIVED the spec treats it as paid and is out of scope.
export const CUSTOMER_CANCELABLE_STATUSES: ReadonlyArray<RideStatus> = [
  "REQUESTED",
  "MATCHING",
  "ACCEPTED"
];

export interface StatusCardProps {
  status: RideStatus;
  driver: DriverSummary | null;
  wsConnected: boolean;
  cancelable: boolean;
  cancelPending: boolean;
  onRequestCancel: () => void;
}

export function StatusCard({
  status,
  driver,
  wsConnected,
  cancelable,
  cancelPending,
  onRequestCancel
}: StatusCardProps) {
  return (
    <Card style={styles.card}>
      <StateStepper status={status} />
      {!wsConnected ? (
        <Text variant="caption">Mất kết nối, đang thử lại...</Text>
      ) : null}
      {driver !== null ? (
        <View style={styles.driverRow}>
          <Text variant="body">Tài xế: {driver.maskedEmail}</Text>
        </View>
      ) : status === "MATCHING" || status === "REQUESTED" ? (
        <Text variant="caption">Đang tìm tài xế gần bạn...</Text>
      ) : null}
      {cancelable ? (
        <Button
          variant="outline"
          onPress={onRequestCancel}
          disabled={cancelPending}
        >
          {cancelPending ? "Đang hủy..." : "Hủy chuyến"}
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 8 },
  driverRow: { marginVertical: 4 }
});
