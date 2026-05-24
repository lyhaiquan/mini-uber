"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
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
    <footer className="border-t border-surface-200 py-6 text-center text-sm text-surface-700 dark:border-surface-800 dark:text-surface-300">
      © {new Date().getFullYear()} RideX. Made for the thesis demo.
    </footer>
  );
}
