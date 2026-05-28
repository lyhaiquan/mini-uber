import type { PricingSummary } from "@ridex/shared-types";
import { Button, Card, Text } from "@ridex/ui-mobile";
import * as React from "react";
import { Modal, StyleSheet, View } from "react-native";

void React;

const vnd = new Intl.NumberFormat("vi-VN");

export interface ReceiptSheetProps {
  open: boolean;
  pricing: PricingSummary | null;
  onClose: () => void;
}

export function ReceiptSheet({ open, pricing, onClose }: ReceiptSheetProps) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={styles.sheet}>
          <Text variant="h2">Chuyến đi hoàn tất</Text>
          {pricing === null ? (
            <Text variant="caption">Đang tổng hợp hóa đơn...</Text>
          ) : (
            <View style={styles.rows}>
              <Row
                label="Quãng đường"
                value={`${(pricing.distanceMeters / 1000).toFixed(2)} km`}
              />
              <Row
                label="Thời gian"
                value={`${Math.round(pricing.durationSeconds / 60)} phút`}
              />
              {pricing.surgeMultiplier > 1 ? (
                <Row
                  label="Hệ số"
                  value={`x${pricing.surgeMultiplier.toFixed(2)}`}
                />
              ) : null}
              <Row label="Thanh toán" value="Ví RideX" />
              <View style={styles.divider} />
              <Row label="Tổng" value={`${vnd.format(pricing.totalVnd)} ₫`} strong />
            </View>
          )}
          <Button onPress={onClose}>Đóng</Button>
        </Card>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  strong
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text variant="body">{label}</Text>
      <Text variant={strong === true ? "h2" : "body"}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  sheet: { padding: 16, gap: 12 },
  rows: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 4 }
});
