import type { RideDetailResponse, RideStatus } from "@ridex/shared-types";
import { Card, Text } from "@ridex/ui-mobile";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { TransitionButton } from "./transition-button";

void React;

const STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: "Đang yêu cầu",
  MATCHING: "Đang tìm tài xế",
  ACCEPTED: "Đã nhận chuyến",
  DRIVER_ARRIVED: "Đã đến điểm đón",
  IN_PROGRESS: "Đang chở khách",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
  NO_DRIVERS_FOUND: "Không có tài xế"
};

export interface InRideCardProps {
  ride: RideDetailResponse;
  transitionPending: boolean;
  onTransition: (next: Exclude<RideStatus, "REQUESTED" | "MATCHING">) => void;
}

export function InRideCard({ ride, transitionPending, onTransition }: InRideCardProps) {
  return (
    <Card style={styles.card}>
      <Text variant="h2">{STATUS_LABEL[ride.status]}</Text>
      <View>
        <Text variant="body">Đón: {ride.pickup.address}</Text>
        <Text variant="body">Đến: {ride.destination.address}</Text>
      </View>
      <TransitionButton
        status={ride.status}
        pending={transitionPending}
        onTransition={onTransition}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 8 }
});
