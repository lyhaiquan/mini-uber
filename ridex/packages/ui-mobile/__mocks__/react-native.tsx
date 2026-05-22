import * as React from "react";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

const host =
  (tag: string) =>
  ({ children, ...rest }: AnyProps) =>
    React.createElement(tag, rest, children);

export const Pressable = host("Pressable");
export const Text = host("Text");
export const View = host("View");
export const TextInput = host("TextInput");
export const ScrollView = host("ScrollView");
export const ActivityIndicator = host("ActivityIndicator");
export const SafeAreaView = host("SafeAreaView");

export const StyleSheet = {
  create: <T extends Record<string, object>>(styles: T): T => styles,
  flatten: (style: unknown) => style
};

export const Platform = { OS: "ios" as const, select: <T,>(map: { ios?: T; android?: T; default?: T }) => map.ios ?? map.default };
export const Linking = { openURL: jest.fn() };

export type PressableProps = AnyProps;
export type TextProps = AnyProps;
export type ViewProps = AnyProps;
export type TextInputProps = AnyProps;
