"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

const baseClassName =
  "inline-flex h-10 w-10 items-center justify-center rounded-md text-surface-900 transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:hover:bg-surface-800";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <button type="button" className={baseClassName} aria-label="Toggle theme" disabled />;
  }

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={baseClassName}
      aria-label={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
