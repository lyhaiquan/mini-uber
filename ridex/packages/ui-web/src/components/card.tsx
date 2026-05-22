import * as React from "react";

import { cn } from "../lib/cn";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-surface-200 bg-surface-0 text-surface-900 shadow-sm dark:border-surface-800 dark:bg-surface-900 dark:text-white",
          className
        )}
        {...props}
      />
    );
  }
);

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
  }
);

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("text-xl font-semibold leading-tight tracking-tight", className)}
        {...props}
      />
    );
  }
);

export const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function CardDescription({ className, ...props }, ref) {
  return <div ref={ref} className={cn("text-sm text-surface-700 dark:text-surface-300", className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
  }
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />;
  }
);
