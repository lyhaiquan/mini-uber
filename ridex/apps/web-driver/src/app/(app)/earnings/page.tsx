"use client";

import { Button, Card, CardContent, Skeleton } from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { BalanceCard } from "@/components/earnings/balance-card";
import { EarningsBarChart } from "@/components/earnings/earnings-bar-chart";
import { EarningsSummaryCard } from "@/components/earnings/earnings-summary-card";
import { TransactionList } from "@/components/earnings/transaction-list";
import { useEarnings, type EarningsWindow } from "@/hooks/use-earnings";
import { usePaymentHistory } from "@/hooks/use-payment-history";
import { useWallet } from "@/hooks/use-wallet";
import { useAuthStore } from "@/lib/auth-store";

export default function EarningsPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const [window, setWindow] = React.useState<EarningsWindow>("week");
  const wallet = useWallet();
  const earnings = useEarnings(window);
  const history = usePaymentHistory();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status !== "authenticated" || !user) {
    return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
  }

  const items = history.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Thu nhập</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Theo dõi số dư ví, tổng thu nhập và lịch sử chuyến hoàn thành.
        </p>
      </header>

      {wallet.data !== undefined ? <BalanceCard balanceVnd={wallet.data.balanceVnd} /> : null}

      {earnings.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : earnings.isError ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">Không tải được tổng quan thu nhập.</p>
            <Button type="button" variant="outline" onClick={() => void earnings.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : earnings.data !== undefined ? (
        <>
          <EarningsSummaryCard
            window={window}
            onWindowChange={setWindow}
            totalEarningsVnd={earnings.data.totalEarningsVnd}
            tripsCompleted={earnings.data.tripsCompleted}
          />
          <EarningsBarChart data={fillMissingDays(earnings.data.byDay)} />
        </>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Chi tiết chuyến</h2>
        {history.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : history.isError ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm text-rose-600">Không tải được lịch sử thu nhập.</p>
              <Button type="button" variant="outline" onClick={() => void history.refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TransactionList
            items={items}
            hasNextPage={history.hasNextPage ?? false}
            isFetchingNextPage={history.isFetchingNextPage}
            onLoadMore={() => void history.fetchNextPage()}
          />
        )}
      </div>
    </section>
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
