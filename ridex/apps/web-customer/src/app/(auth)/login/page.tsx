"use client";

import { AuthForm, toast } from "@ridex/ui-web";
import { useRouter } from "next/navigation";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  return (
    <AuthForm
      mode="login"
      title="Đăng nhập"
      submitLabel="Đăng nhập"
      switchHref="/register"
      switchLabel="Chưa có tài khoản? Đăng ký ngay"
      onSubmit={async (input) => {
        const result = await authActions.login(input);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        setAuth({ accessToken: result.data.accessToken, user: result.data.user });
        toast.success("Đăng nhập thành công");
        router.replace("/home");
        return { ok: true };
      }}
    />
  );
}
