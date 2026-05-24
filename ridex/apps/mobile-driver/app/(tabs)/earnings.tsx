import { Button, Card, Screen, Text } from "@ridex/ui-mobile";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { useEarnings, type EarningsWindow } from "../../src/hooks/use-earnings";
import { usePaymentHistory } from "../../src/hooks/use-payment-history";
import { useWallet } from "../../src/hooks/use-wallet";

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function EarningsTab() {
  const router = useRouter();
  const [window, setWindow] = React.useState<EarningsWindow>("week");
  const wallet = useWallet();
  const earnings = useEarnings(window);
  const history = usePaymentHistory();
  const items = history.data?.pages.flatMap((page) => page.data) ?? [];
  const bars = fillMissingDays(earnings.data?.byDay ?? []);
  const max = Math.max(1, ...bars.map((item) => item.earningsVnd));
  const refreshing = wallet.isRefetching || earnings.isRefetching || history.isRefetching;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void wallet.refetch();
              void earnings.refetch();
              void history.refetch();
            }}
          />
        }
      >
        <Text variant="h2">Thu nhập</Text>

        <Card style={styles.card}>
          <Text variant="caption">Số dư ví tài xế</Text>
          <Text variant="h2">{formatVnd(wallet.data?.balanceVnd ?? 0)}</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.tabs}>
            {[
              ["today", "Hôm nay"],
              ["week", "Tuần này"],
              ["month", "Tháng"]
            ].map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.tab, window === id && styles.tabActive]}
                onPress={() => setWindow(id as EarningsWindow)}
              >
                <Text variant="caption">{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text variant="h2">{formatVnd(earnings.data?.totalEarningsVnd ?? 0)}</Text>
          <Text variant="body">{earnings.data?.tripsCompleted ?? 0} chuyến hoàn thành</Text>
          <View style={styles.chart}>
            {bars.map((item) => (
              <View key={item.date} style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(8, (item.earningsVnd / max) * 100)}%` as never }
                  ]}
                />
                <Text variant="caption">{item.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.section}>
          <Text variant="h2">Chi tiết chuyến</Text>
          {items.length === 0 ? (
            <Card style={styles.card}>
              <Text variant="body">Bật trạng thái online để nhận chuyến đầu tiên.</Text>
              <Button onPress={() => router.replace("/(tabs)/home" as never)}>Về trang chủ</Button>
            </Card>
          ) : (
            items.map((item) => (
              <Card key={item.id} style={styles.card}>
                <Text variant="body">
                  {item.rideSummary.pickupAddress} → {item.rideSummary.destinationAddress}
                </Text>
                <Text variant="body">+{formatVnd(item.driverShareVnd)}</Text>
                <Text variant="caption">{formatDate(item.createdAt)}</Text>
              </Card>
            ))
          )}
          {history.hasNextPage ? (
            <Button
              disabled={history.isFetchingNextPage}
              onPress={() => void history.fetchNextPage()}
            >
              {history.isFetchingNextPage ? "Đang tải..." : "Xem thêm"}
            </Button>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function fillMissingDays(data: Array<{ date: string; earningsVnd: number; trips: number }>) {
  if (data.length >= 7) return data.slice(-7);
  const byDate = new Map(data.map((item) => [item.date, item]));
  const out: Array<{ date: string; earningsVnd: number; trips: number }> = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(byDate.get(key) ?? { date: key, earningsVnd: 0, trips: 0 });
  }
  return out;
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 12 },
  card: { padding: 12, gap: 8 },
  section: { gap: 12 },
  tabs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e5e7eb"
  },
  tabActive: { backgroundColor: "#a7f3d0" },
  chart: { height: 160, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  barWrap: { flex: 1, alignItems: "center", gap: 6 },
  bar: {
    width: "100%",
    backgroundColor: "#10b981",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6
  }
});
