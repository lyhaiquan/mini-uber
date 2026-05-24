"use client";

import type { PaymentHistoryItem } from "@ridex/shared-types";
import { Button, Card, CardContent } from "@ridex/ui-web";
import Link from "next/link";

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

export function TransactionList(props: {
  items: PaymentHistoryItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  if (props.items.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="text-lg font-semibold">Chưa có chuyến nào trong giai đoạn này</p>
          <p className="text-sm text-surface-600 dark:text-surface-300">
            Bật trạng thái online để bắt đầu nhận chuyến.
          </p>
          <Button asChild>
            <Link href="/home">Về trang chủ</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {props.items.map((item) => (
        <Card key={item.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {item.rideSummary.pickupAddress} → {item.rideSummary.destinationAddress}
                </p>
                <p className="text-sm text-surface-600 dark:text-surface-300">
                  {formatDate(item.createdAt)}
                </p>
              </div>
              <p className="font-semibold text-emerald-600">
                +{formatVnd(item.driverShareVnd)}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
      {props.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={props.isFetchingNextPage}
          onClick={props.onLoadMore}
        >
          {props.isFetchingNextPage ? "Đang tải..." : "Xem thêm"}
        </Button>
      ) : null}
    </div>
  );
}
