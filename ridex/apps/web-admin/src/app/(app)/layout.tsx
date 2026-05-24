"use client";

import { Sidebar } from "@/components/admin/sidebar";
import { TopBar } from "@/components/admin/top-bar";
import { RootShell } from "@/components/root-shell";
import { useRequireAdmin } from "@/hooks/use-require-admin";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAdmin();

  if (!ready) {
    return (
      <RootShell>
        <div className="mx-auto w-full max-w-7xl px-4 py-6">
          <div className="rounded-3xl border border-surface-200 bg-white/90 px-5 py-8 text-sm text-surface-700 shadow-sm dark:border-surface-800 dark:bg-surface-900/90 dark:text-surface-300">
            Dang tai khu quan tri...
          </div>
        </div>
      </RootShell>
    );
  }

  return (
    <RootShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <div className="min-w-0 flex-1 space-y-6">
            <TopBar />
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </RootShell>
  );
}
