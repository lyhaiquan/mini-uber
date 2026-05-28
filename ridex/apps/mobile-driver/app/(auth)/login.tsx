import { Button, Card, Input, Screen, Text } from "@ridex/ui-mobile";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { authClient } from "../../src/lib/auth-client";
import { useAuthStore } from "../../src/lib/auth-store";

export default function DriverLoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu");
      return;
    }
    setSubmitting(true);
    const result = await authClient.login({ email, password });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAuth(result.session);
    router.replace("/(tabs)/home");
  };

  return (
    <Screen>
      <View className="flex-1 justify-center gap-4">
        <Text variant="h2">Đăng nhập tài xế</Text>
        <Card>
          <View className="gap-3">
            <Input
              accessibilityLabel="driver-login-email"
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!submitting}
            />
            <Input
              accessibilityLabel="driver-login-password"
              placeholder="Mật khẩu"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!submitting}
            />
            {error ? (
              <Text variant="caption" className="text-state-error">
                {error}
              </Text>
            ) : null}
            <Button
              accessibilityLabel="driver-login-submit"
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </View>
        </Card>
        <Text variant="caption" className="text-center">
          Tài khoản tài xế do vận hành cấp.
        </Text>
      </View>
    </Screen>
  );
}
