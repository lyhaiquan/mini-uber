import * as React from "react";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

export const SafeAreaProvider = ({ children, ...rest }: AnyProps) =>
  React.createElement("SafeAreaProvider", rest, children);
export const SafeAreaView = ({ children, ...rest }: AnyProps) =>
  React.createElement("SafeAreaView", rest, children);
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
