import * as React from "react";

import { cn } from "../lib/cn";

export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Skeleton({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "animate-pulse rounded-md bg-surface-200 dark:bg-surface-800",
          className
        )}
        {...props}
      />
    );
  }
);
