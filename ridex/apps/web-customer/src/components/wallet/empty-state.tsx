"use client";

import { Button, Card, CardContent } from "@ridex/ui-web";
import Link from "next/link";

export function EmptyState() {
  return (
    <Card>
      <CardContent className="space-y-3 p-6 text-center">
        <p className="text-lg font-semibold">Chưa có giao dịch nào</p>
        <p className="text-sm text-surface-600 dark:text-surface-300">
          Đặt chuyến đầu tiên của bạn để thấy lịch sử thanh toán ở đây.
        </p>
        <Button asChild>
          <Link href="/home">Về trang chủ</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
