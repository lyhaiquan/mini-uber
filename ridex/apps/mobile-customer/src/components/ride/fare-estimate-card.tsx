import type { QuoteResponse } from "@ridex/shared-types";
import { Card, Text } from "@ridex/ui-mobile";
import * as React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

void React;

export function roundUpVnd(vnd: number): number {
  return Math.ceil(vnd / 1000) * 1000;
}

export function formatVnd(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(vnd)} ₫`;
}

interface Props {
  quote?: QuoteResponse;
  loading?: boolean;
}

export function FareEstimateCard({ quote, loading }: Props) {
  if (loading === true || quote === undefined) {
    return (
      <Card>
        <ActivityIndicator testID="fare-card-skeleton" />
      </Card>
    );
  }
  const total = roundUpVnd(quote.totalVnd);
  const km = (quote.distanceMeters / 1000).toFixed(1);
  const min = Math.round(quote.durationSeconds / 60);
  return (
    <Card>
      <View style={styles.row}>
        <Text variant="h2">{formatVnd(total)}</Text>
        {quote.surgeMultiplier > 1 ? (
          <View style={styles.badge}>
            <Text variant="caption" style={styles.badgeText}>
              ×{quote.surgeMultiplier.toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption">
        {km} km · ~{min} phút · Base {formatVnd(quote.baseFareVnd)}
      </Text>
      {quote.routeConfidence === "low" ? (
        <Text variant="caption" style={styles.lowConfidence}>
          Ước tính có thể chênh.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    backgroundColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  badgeText: { color: "#78350f", fontWeight: "600" },
  lowConfidence: { fontStyle: "italic", color: "#64748b", marginTop: 4 }
});
