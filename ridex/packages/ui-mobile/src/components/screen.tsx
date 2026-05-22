import * as React from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "../lib/cn";

export interface ScreenProps extends ViewProps {
  scroll?: boolean;
  className?: string;
}

export function Screen({ children, scroll = false, className, ...props }: ScreenProps) {
  const content = (
    <View className={cn("flex-1 bg-surface-0 px-4 py-4", className)} {...props}>
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-0">
      {scroll ? (
        <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
