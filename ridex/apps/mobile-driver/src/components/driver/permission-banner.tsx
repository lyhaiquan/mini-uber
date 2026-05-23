import { Button, Text } from "@ridex/ui-mobile";
import * as Linking from "expo-linking";
import * as React from "react";
import { StyleSheet, View } from "react-native";

void React;

export function PermissionBanner() {
  return (
    <View style={styles.banner}>
      <Text variant="body">Cần quyền vị trí để online.</Text>
      <Button variant="outline" onPress={() => void Linking.openSettings()}>
        Mở cài đặt
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#fef3c7",
    padding: 12,
    borderRadius: 8,
    gap: 8
  }
});
