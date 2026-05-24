"use client";

import { usePathname } from "next/navigation";

import { AuthMenu } from "./auth-menu";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/rides") ||
    pathname.startsWith("/drivers") ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/home")
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-200 bg-surface-0/90 backdrop-blur supports-[backdrop-filter]:bg-surface-0/60 dark:border-surface-800 dark:bg-surface-900/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a href="/" className="text-lg font-semibold tracking-tight">
          RideX <span className="text-primary-500">Admin</span>
        </a>
        <nav className="flex items-center gap-2">
          <AuthMenu />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
