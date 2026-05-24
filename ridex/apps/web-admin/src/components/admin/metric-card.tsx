"use client";

import * as React from "react";

void React;

export interface MetricRow {
  label: string;
  value: string | number;
  emphasis?: boolean;
}

export interface MetricCardProps {
  title: string;
  metrics: MetricRow[];
  badge?: string;
  loading?: boolean;
  "data-section"?: string;
}

export function MetricCard({ title, metrics, badge, loading, ...rest }: MetricCardProps) {
  const dataSection = rest["data-section"];
  const emphasis = metrics.find((m) => m.emphasis === true);
  const restMetrics = metrics.filter((m) => m !== emphasis);

  return (
    <section
      data-section={dataSection}
      className="rounded-lg border border-surface-200 bg-surface-0 text-surface-900 shadow-sm dark:border-surface-800 dark:bg-surface-900 dark:text-white"
    >
      <div className="space-y-3 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
            {title}
          </h3>
          {badge !== undefined ? (
            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-200">
              {badge}
            </span>
          ) : null}
        </header>

        {loading === true ? (
          <div className="space-y-2" data-testid="metric-card-skeleton">
            <div className="h-8 w-32 animate-pulse rounded-md bg-surface-200 dark:bg-surface-800" />
            <div className="h-4 w-40 animate-pulse rounded-md bg-surface-200 dark:bg-surface-800" />
            <div className="h-4 w-28 animate-pulse rounded-md bg-surface-200 dark:bg-surface-800" />
          </div>
        ) : (
          <>
            {emphasis !== undefined ? (
              <p className="text-3xl font-bold tracking-tight">
                <span className="sr-only">{emphasis.label}: </span>
                {emphasis.value}
              </p>
            ) : null}
            <dl className="space-y-1 text-sm">
              {restMetrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <dt className="text-surface-600 dark:text-surface-300">{m.label}</dt>
                  <dd className="font-medium">{m.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </section>
  );
}
