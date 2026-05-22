import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-500 text-white",
        secondary: "border-transparent bg-surface-100 text-surface-900 dark:bg-surface-800 dark:text-white",
        outline: "border-surface-300 text-surface-900 dark:border-surface-700 dark:text-white",
        success: "border-transparent bg-state-success text-white",
        warning: "border-transparent bg-state-warning text-white",
        destructive: "border-transparent bg-state-error text-white"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { badgeVariants };
