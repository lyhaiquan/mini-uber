import { Button, Card, Screen, Text } from "@ridex/ui-mobile";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { authClient } from "../../src/lib/auth-client";
import { useAuthStore } from "../../src/lib/auth-store";

export default function ProfileTab() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const handleLogout = async () => {
    await authClient.logout();
    clear();
    router.replace("/(auth)/login");
  };

  return (
    <Screen>
      <View className="gap-4">
        <Text variant="h2">Tôi</Text>
        {user ? (
          <Card>
            <View className="gap-2">
              <Text variant="body">Email: {user.email}</Text>
              <Text variant="body">Vai trò: {user.role}</Text>
            </View>
          </Card>
        ) : null}
        <Button variant="outline" onPress={handleLogout}>
          Đăng xuất
        </Button>
      </View>
    </Screen>
  );
}
