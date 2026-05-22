"use client";

import { Card, CardContent, CardDescription, CardTitle } from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/lib/auth-store";

export default function CustomerHomePage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <section className="space-y-2">
        <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Xin chào, {user.email}</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Bạn đang đăng nhập với vai trò <strong>{user.role}</strong>.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-2 p-6">
          <CardTitle>Đặt xe (sắp ra mắt)</CardTitle>
          <CardDescription>
            Tính năng đặt xe + theo dõi tài xế live sẽ có ở T017 / T018.
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
