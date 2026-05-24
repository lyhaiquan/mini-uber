"use client";

import { Button } from "@ridex/ui-web";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

export function AuthMenu(): React.ReactElement | null {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  if (status === "idle" || status === "hydrating") {
    return <div className="h-8 w-20 animate-pulse rounded bg-surface-200 dark:bg-surface-800" />;
  }

  if (status === "authenticated" && user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/earnings">Thu nhập</Link>
        </Button>
        <span className="hidden text-sm text-surface-700 dark:text-surface-300 sm:inline">
          {user.email}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await authActions.logout();
            clear();
            router.replace("/");
          }}
        >
          Đăng xuất
        </Button>
      </div>
    );
  }

  return (
    <Button asChild size="sm">
      <Link href="/login">Đăng nhập</Link>
    </Button>
  );
}
