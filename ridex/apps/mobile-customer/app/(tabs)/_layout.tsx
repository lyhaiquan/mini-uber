import { Redirect, Tabs } from "expo-router";

import { useAuthStore } from "../../src/lib/auth-store";

export default function TabsLayout() {
  const status = useAuthStore((s) => s.status);

  if (status === "idle" || status === "hydrating") {
    return null;
  }
  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs>
      <Tabs.Screen name="home" options={{ title: "Trang chủ" }} />
      <Tabs.Screen name="trips" options={{ title: "Chuyến đi" }} />
      <Tabs.Screen name="wallet" options={{ title: "Ví" }} />
      <Tabs.Screen name="profile" options={{ title: "Tôi" }} />
    </Tabs>
  );
}
