"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-0 group-[.toaster]:text-surface-900 group-[.toaster]:border-surface-200 group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-surface-900 dark:group-[.toaster]:text-white dark:group-[.toaster]:border-surface-800",
          description: "group-[.toast]:text-surface-700 dark:group-[.toast]:text-surface-300",
          actionButton: "group-[.toast]:bg-primary-500 group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-surface-100 group-[.toast]:text-surface-900"
        }
      }}
      {...props}
    />
  );
}

export { toast };
