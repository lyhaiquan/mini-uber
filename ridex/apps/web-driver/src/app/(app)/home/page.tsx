"use client";

import { Card, CardContent, CardDescription, CardTitle } from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/lib/auth-store";

export default function DriverHomePage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Trạm điều phối</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Tài xế: <strong>{user.email}</strong> · vai trò <strong>{user.role}</strong>.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-2 p-6">
          <CardTitle>Online / Offline (sắp ra mắt)</CardTitle>
          <CardDescription>
            Toggle online + nhận offer chuyến đi sẽ có ở T019 / T020.
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
