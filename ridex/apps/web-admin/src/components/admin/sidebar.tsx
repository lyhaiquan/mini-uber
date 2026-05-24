"use client";

import { usePathname, useRouter } from "next/navigation";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tá»•ng quan" },
  { href: "/rides", label: "Chuyáº¿n Ä‘i" },
  { href: "/drivers", label: "TÃ i xáº¿" },
  { href: "/payments", label: "Thanh toÃ¡n" }
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  return (
    <aside className="flex w-full flex-col gap-5 rounded-3xl border border-surface-200 bg-white/90 p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900/90 lg:sticky lg:top-6 lg:w-72 lg:self-start">
      <div className="space-y-1">
        <a href="/dashboard" className="block text-lg font-semibold tracking-tight">
          RideX <span className="text-primary-500">Admin</span>
        </a>
        <p className="text-sm text-surface-600 dark:text-surface-300">
          Báº£ng Ä‘iá»u hÃ nh váº­n hÃ nh
        </p>
      </div>

      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <a
              key={item.href}
              href={item.href}
              className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-primary-500 text-white shadow-sm"
                  : "bg-surface-50 text-surface-700 hover:bg-surface-100 dark:bg-surface-800/80 dark:text-surface-200 dark:hover:bg-surface-800"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      <button
        type="button"
        className="mt-auto inline-flex h-10 items-center justify-start rounded-2xl border border-surface-300 px-4 text-sm font-medium text-surface-900 transition-colors hover:bg-surface-100 dark:border-surface-700 dark:text-white dark:hover:bg-surface-800"
        onClick={async () => {
          await authActions.logout();
          clear();
          router.replace("/login");
        }}
      >
        ÄÄƒng xuáº¥t
      </button>
    </aside>
  );
}
