"use client";

import { Button, Card, CardContent, Skeleton } from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionList } from "@/components/wallet/transaction-list";
import { usePaymentHistory } from "@/hooks/use-payment-history";
import { useWallet } from "@/hooks/use-wallet";
import { useAuthStore } from "@/lib/auth-store";

export default function WalletPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const wallet = useWallet();
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
        <h1 className="text-2xl font-semibold tracking-tight">Ví RideX</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Theo dõi số dư và lịch sử thanh toán chuyến đi.
        </p>
      </header>

      {wallet.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
      ) : wallet.isError ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">Không tải được số dư ví.</p>
            <Button type="button" variant="outline" onClick={() => void wallet.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : (
        <BalanceCard balanceVnd={wallet.data?.balanceVnd ?? 0} />
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Giao dịch gần đây</h2>
        {history.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : history.isError ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm text-rose-600">Không tải được lịch sử giao dịch.</p>
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
