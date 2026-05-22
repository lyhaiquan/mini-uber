import * as React from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "../lib/cn";

export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        "rounded-lg border border-surface-200 bg-surface-0 p-4 shadow-sm",
        className
      )}
      {...props}
    />
  );
}
