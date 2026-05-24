"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/lib/auth-store";

export function TopBar() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-surface-200 bg-white/85 px-5 py-4 shadow-sm backdrop-blur dark:border-surface-800 dark:bg-surface-900/85">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-surface-500 dark:text-surface-400">
          Admin Console
        </p>
        <p className="text-sm text-surface-700 dark:text-surface-200">
          {user?.email ?? "Đang xác thực"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          Quyền ADMIN
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
