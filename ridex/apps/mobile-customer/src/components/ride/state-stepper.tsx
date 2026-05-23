import { Text } from "@ridex/ui-mobile";
import type { RideStatus } from "@ridex/shared-types";
import * as React from "react";
import { StyleSheet, View } from "react-native";

void React;

const STEPS: { status: RideStatus; label: string }[] = [
  { status: "REQUESTED", label: "Yêu cầu" },
  { status: "MATCHING", label: "Tìm tài xế" },
  { status: "ACCEPTED", label: "Đã nhận" },
  { status: "IN_PROGRESS", label: "Đang đi" },
  { status: "COMPLETED", label: "Hoàn tất" }
];

export interface StateStepperProps {
  status: RideStatus;
}

// Vietnamese label set kept in sync with the web stepper. DRIVER_ARRIVED is
// collapsed into ACCEPTED here too — the difference does not justify a 6th
// dot on the rail, and the customer already sees driver-arrived elsewhere.
export function StateStepper({ status }: StateStepperProps) {
  if (status === "CANCELLED" || status === "NO_DRIVERS_FOUND") {
    return (
      <View style={[styles.chip, styles.chipError]}>
        <Text variant="caption">
          {status === "CANCELLED" ? "Đã hủy" : "Không tìm thấy tài xế"}
        </Text>
      </View>
    );
  }
  const effective: RideStatus = status === "DRIVER_ARRIVED" ? "ACCEPTED" : status;
  const currentIndex = STEPS.findIndex((s) => s.status === effective);

  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        const color = isPast ? "#10b981" : isCurrent ? "#2563eb" : "#9ca3af";
        return (
          <View key={step.status} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text variant="caption">{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  item: { alignItems: "center", flex: 1, gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chip: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  chipError: { backgroundColor: "#fee2e2" }
});
