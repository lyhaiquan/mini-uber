import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";

import { cn } from "../lib/cn";

export interface InputProps extends TextInputProps {
  className?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { className, placeholderTextColor = "#9ca3af", ...props },
  ref
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={placeholderTextColor}
      className={cn(
        "h-12 w-full rounded-md border border-surface-300 bg-surface-0 px-3 text-base text-surface-900",
        className
      )}
      {...props}
    />
  );
});
