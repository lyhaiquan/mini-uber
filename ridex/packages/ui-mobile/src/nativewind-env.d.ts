/// <reference types="nativewind/types" />

import "react-native";
import "react-native-safe-area-context";

declare module "react-native" {
  interface PressableProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface ScrollViewProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface TextProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface TextInputProps {
    className?: string;
    cssInterop?: boolean;
  }

  interface ViewProps {
    className?: string;
    cssInterop?: boolean;
  }
}

declare module "react-native-safe-area-context" {
  interface NativeSafeAreaViewProps {
    className?: string;
    cssInterop?: boolean;
  }
}
