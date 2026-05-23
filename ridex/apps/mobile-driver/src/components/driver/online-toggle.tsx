import { Text } from "@ridex/ui-mobile";
import * as React from "react";
import { Pressable, StyleSheet } from "react-native";

void React;

export interface OnlineToggleProps {
  state: "online" | "offline" | "going-online" | "going-offline";
  disabled?: boolean;
  onGo: () => void;
  onStop: () => void;
}

export function OnlineToggle({ state, disabled, onGo, onStop }: OnlineToggleProps) {
  const isOnline = state === "online" || state === "going-offline";
  const isBusy = state === "going-online" || state === "going-offline";

  const label = isBusy
    ? state === "going-online"
      ? "..."
      : "..."
    : isOnline
      ? "STOP"
      : "GO";

  const bg = isOnline ? "#059669" : "#9ca3af";

  return (
    <Pressable
      onPress={() => (isOnline ? onStop() : onGo())}
      disabled={disabled === true || isBusy}
      accessibilityLabel={`driver-online-toggle-${state}`}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled === true || isBusy ? 0.6 : 1 }]}
    >
      <Text variant="h2" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center"
  },
  label: { color: "#ffffff" }
});
