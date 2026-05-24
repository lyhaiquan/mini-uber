"use client";

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
        <span className="hidden text-sm text-surface-700 dark:text-surface-300 sm:inline">
          {user.email} Â· {user.role}
        </span>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-surface-900 transition-colors hover:bg-surface-100 dark:text-white dark:hover:bg-surface-800"
          onClick={async () => {
            await authActions.logout();
            clear();
            router.replace("/");
          }}
        >
          ÄÄƒng xuáº¥t
        </button>
      </div>
    );
  }

  return (
    <a
      href="/login"
      className="inline-flex h-9 items-center justify-center rounded-md bg-primary-500 px-3 text-sm font-medium text-white transition-colors hover:bg-primary-600"
    >
      ÄÄƒng nháº­p
    </a>
  );
}
