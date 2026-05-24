"use client";

import * as React from "react";

import { DriversSection } from "@/components/admin/drivers-section";
import { LastUpdatedPill } from "@/components/admin/last-updated-pill";
import { PaymentsSection } from "@/components/admin/payments-section";
import { PlaceholderSection } from "@/components/admin/placeholder-section";
import { RidesSection } from "@/components/admin/rides-section";
import { useAdminDashboardSummary } from "@/hooks/use-admin-dashboard";

export default function DashboardPage() {
  const query = useAdminDashboardSummary();
  const data = query.data ?? null;

  const isEmpty =
    !query.isLoading &&
    data !== null &&
    data.rides.totalLast24h === 0 &&
    data.rides.active === 0 &&
    data.payments.successCountLast24h === 0 &&
    data.drivers.online === 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tá»•ng quan váº­n hÃ nh</h1>
        <LastUpdatedPill dataUpdatedAt={query.dataUpdatedAt} />
      </header>

      {query.isError ? (
        <section className="rounded-lg border border-surface-200 bg-surface-0 text-surface-900 shadow-sm dark:border-surface-800 dark:bg-surface-900 dark:text-white">
          <div className="space-y-3 p-6">
            <p className="text-sm text-red-700 dark:text-red-300">
              KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u váº­n hÃ nh.
            </p>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md border border-surface-300 px-4 text-sm font-medium text-surface-900 transition-colors hover:bg-surface-100 dark:border-surface-700 dark:text-white dark:hover:bg-surface-800"
              onClick={() => void query.refetch()}
            >
              Thá»­ láº¡i
            </button>
          </div>
        </section>
      ) : null}

      {isEmpty ? (
        <section className="rounded-lg border border-surface-200 bg-surface-0 text-surface-900 shadow-sm dark:border-surface-800 dark:bg-surface-900 dark:text-white">
          <div className="p-6 text-sm text-surface-700 dark:text-surface-300">
            ChÆ°a cÃ³ dá»¯ liá»‡u váº­n hÃ nh. Khi khÃ¡ch hÃ ng vÃ  tÃ i xáº¿ báº¯t Ä‘áº§u sá»­ dá»¥ng, sá»‘
            liá»‡u sáº½ xuáº¥t hiá»‡n á»Ÿ Ä‘Ã¢y.
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RidesSection data={data?.rides ?? null} loading={query.isLoading} />
        <DriversSection data={data?.drivers ?? null} loading={query.isLoading} />
        <PaymentsSection data={data?.payments ?? null} loading={query.isLoading} />
        <PlaceholderSection data={data?.placeholders ?? null} loading={query.isLoading} />
      </div>
    </section>
  );
}
