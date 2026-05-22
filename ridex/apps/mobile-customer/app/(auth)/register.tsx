import { Button, Card, Input, Screen, Text } from "@ridex/ui-mobile";
import { Link, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { authClient } from "../../src/lib/auth-client";
import { useAuthStore } from "../../src/lib/auth-store";

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }
    setSubmitting(true);
    const result = await authClient.register({ email, password });
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
        <Text variant="h2">Tạo tài khoản</Text>
        <Card>
          <View className="gap-3">
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!submitting}
            />
            <Input
              placeholder="Mật khẩu (tối thiểu 8 ký tự)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!submitting}
            />
            <Input
              placeholder="Nhập lại mật khẩu"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              editable={!submitting}
            />
            {error ? (
              <Text variant="caption" className="text-state-error">
                {error}
              </Text>
            ) : null}
            <Button onPress={handleSubmit} disabled={submitting}>
              {submitting ? "Đang xử lý..." : "Đăng ký"}
            </Button>
          </View>
        </Card>
        <Link href="/(auth)/login" asChild>
          <Text variant="caption" className="text-center text-primary-500">
            Đã có tài khoản? Đăng nhập
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
