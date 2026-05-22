"use client";

import { Card, CardContent, CardDescription, CardTitle } from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/lib/auth-store";

export default function AdminHomePage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && user && user.role !== "ADMIN") {
      router.replace("/403");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user || user.role !== "ADMIN") {
    return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bảng điều khiển</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Admin: <strong>{user.email}</strong>
        </p>
      </header>

      <Card>
        <CardContent className="space-y-2 p-6">
          <CardTitle>Dashboard (sắp ra mắt)</CardTitle>
          <CardDescription>
            KPI ride, driver online, GMV, fraud alerts sẽ có ở T021 trên endpoint{" "}
            <code className="rounded bg-surface-100 px-1 dark:bg-surface-800">
              GET /admin/dashboard/summary
            </code>
            .
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
