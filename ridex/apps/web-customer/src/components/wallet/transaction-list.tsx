"use client";

import type { PaymentHistoryItem } from "@ridex/shared-types";
import { Button } from "@ridex/ui-web";

import { EmptyState } from "./empty-state";
import { TransactionItem } from "./transaction-item";

export function TransactionList(props: {
  items: PaymentHistoryItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  if (props.items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {props.items.map((item) => (
        <TransactionItem key={item.id} item={item} />
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
