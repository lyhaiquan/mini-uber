"use client";

import { AuthForm, toast } from "@ridex/ui-web";
import { useRouter } from "next/navigation";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);

  return (
    <AuthForm
      mode="login"
      title="Đăng nhập quản trị"
      submitLabel="Đăng nhập"
      onSubmit={async (input) => {
        const result = await authActions.login(input);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }

        if (result.data.user.role !== "ADMIN") {
          await authActions.logout();
          clear();
          const msg = "Tài khoản không có quyền truy cập admin";
          toast.error(msg);
          router.replace("/403");
          return { ok: false, error: msg };
        }

        setAuth({ accessToken: result.data.accessToken, user: result.data.user });
        toast.success("Đăng nhập thành công");
        router.replace("/home");
        return { ok: true };
      }}
    />
  );
}
