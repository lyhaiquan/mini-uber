import * as React from "react";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

import { cn } from "../lib/cn";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary-500 active:bg-primary-600",
  secondary: "bg-surface-200 active:bg-surface-300",
  outline: "border border-surface-300 bg-transparent active:bg-surface-100",
  ghost: "bg-transparent active:bg-surface-100",
  destructive: "bg-state-error active:opacity-90"
};

const variantTextClasses: Record<ButtonVariant, string> = {
  default: "text-white",
  secondary: "text-surface-900",
  outline: "text-surface-900",
  ghost: "text-surface-900",
  destructive: "text-white"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-4",
  lg: "h-12 px-6"
};

export interface ButtonProps extends Omit<PressableProps, "children"> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = "default",
  size = "md",
  loading,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled === true || loading === true;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={cn(
        "flex-row items-center justify-center rounded-md",
        variantClasses[variant],
        sizeClasses[size],
        isDisabled ? "opacity-50" : "",
        className
      )}
      {...props}
    >
      {loading === true ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text className={cn("text-base font-medium", variantTextClasses[variant])}>{children}</Text>
      )}
    </Pressable>
  );
}
