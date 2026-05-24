import { Button, Card, Screen, Text } from "@ridex/ui-mobile";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

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

export default function WalletTab() {
  const router = useRouter();
  const wallet = useWallet();
  const history = usePaymentHistory();
  const items = history.data?.pages.flatMap((page) => page.data) ?? [];
  const refreshing = wallet.isRefetching || history.isRefetching;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void wallet.refetch();
              void history.refetch();
            }}
          />
        }
      >
        <Text variant="h2">Ví RideX</Text>

        <Card style={styles.card}>
          <Text variant="caption">Số dư hiện tại</Text>
          <Text variant="h2">{formatVnd(wallet.data?.balanceVnd ?? 0)}</Text>
          <Text variant="caption">Nạp tiền sẽ được bổ sung ở bước sau.</Text>
        </Card>

        <View style={styles.section}>
          <Text variant="h2">Giao dịch gần đây</Text>
          {items.length === 0 ? (
            <Card style={styles.card}>
              <Text variant="body">Đặt chuyến đầu tiên của bạn để thấy lịch sử ở đây.</Text>
              <Button onPress={() => router.replace("/(tabs)/home" as never)}>
                Về trang chủ
              </Button>
            </Card>
          ) : (
            items.map((item) => (
              <Card key={item.id} style={styles.card}>
                <Text variant="body">
                  {item.rideSummary.pickupAddress} → {item.rideSummary.destinationAddress}
                </Text>
                <Text variant="body">
                  {item.status === "SUCCEEDED"
                    ? `-${formatVnd(item.totalVnd)}`
                    : "Lỗi thanh toán"}
                </Text>
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

const styles = StyleSheet.create({
  content: { gap: 12, padding: 12 },
  section: { gap: 12 },
  card: { padding: 12, gap: 8 }
});
