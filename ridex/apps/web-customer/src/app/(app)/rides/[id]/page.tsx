"use client";

import { useParams } from "next/navigation";
import * as React from "react";

void React;

export default function RideDetailPlaceholderPage() {
  const params = useParams<{ id: string }>();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Chuyến xe</h1>
      <p className="text-sm text-surface-700 dark:text-surface-300">
        Ride ID: <code>{params.id}</code>
      </p>
      <p className="text-sm italic text-surface-500">
        Trang theo dõi chuyến đi sẽ được triển khai ở Task 018.
      </p>
    </section>
  );
}
