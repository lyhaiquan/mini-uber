import { Text } from "@ridex/ui-mobile";
import * as React from "react";
import { StyleSheet, View } from "react-native";

void React;

export interface StatusPillProps {
  state: "online" | "offline" | "loading";
}

export function StatusPill({ state }: StatusPillProps) {
  const label = state === "online" ? "Online" : state === "loading" ? "..." : "Offline";
  const bg = state === "online" ? "#d1fae5" : "#e5e7eb";
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessibilityLabel={`driver-status-${state}`}>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" }
});
