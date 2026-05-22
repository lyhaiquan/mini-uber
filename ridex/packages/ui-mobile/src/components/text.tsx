import * as React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cn } from "../lib/cn";

export type TextVariant = "h1" | "h2" | "body" | "caption";

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
}

const variantClasses: Record<TextVariant, string> = {
  h1: "text-3xl font-bold text-surface-900",
  h2: "text-2xl font-semibold text-surface-900",
  body: "text-base text-surface-900",
  caption: "text-sm text-surface-700"
};

export function Text({ variant = "body", className, ...props }: TextProps) {
  return <RNText className={cn(variantClasses[variant], className)} {...props} />;
}
