"use client";

import { AuthForm, toast } from "@ridex/ui-web";
import { useRouter } from "next/navigation";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  return (
    <AuthForm
      mode="register"
      title="Tạo tài khoản"
      submitLabel="Đăng ký"
      switchHref="/login"
      switchLabel="Đã có tài khoản? Đăng nhập"
      onSubmit={async (input) => {
        const result = await authActions.register(input);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        setAuth({ accessToken: result.data.accessToken, user: result.data.user });
        toast.success("Tạo tài khoản thành công");
        router.replace("/home");
        return { ok: true };
      }}
    />
  );
}
