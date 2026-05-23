import { Screen, Text } from "@ridex/ui-mobile";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";

void React;

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <Text variant="h2">Chuyến xe</Text>
      <Text variant="body">Ride ID: {id}</Text>
      <Text variant="caption">Trang theo dõi sẽ có ở Task 018.</Text>
    </Screen>
  );
}
