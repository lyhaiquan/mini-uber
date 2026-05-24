"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await authActions.login({ email, password });
    if (!result.ok) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    if (result.data.user.role !== "ADMIN") {
      await authActions.logout();
      clear();
      const message = "TÃ i khoáº£n khÃ´ng cÃ³ quyá»n truy cáº­p admin";
      setError(message);
      setIsSubmitting(false);
      router.replace("/403");
      return;
    }

    setAuth(result.data);
    setIsSubmitting(false);
    router.replace("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-2xl font-semibold tracking-tight">ÄÄƒng nháº­p quáº£n trá»‹</h1>

      <div className="space-y-2">
        <label htmlFor="auth-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          className="flex h-10 w-full rounded-md border border-surface-300 bg-transparent px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="auth-password" className="text-sm font-medium">
          Máº­t kháº©u
        </label>
        <input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          className="flex h-10 w-full rounded-md border border-surface-300 bg-transparent px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700"
          required
        />
      </div>

      {error ? (
        <p
          className="rounded-md border border-state-error/30 bg-state-error/5 px-3 py-2 text-sm text-state-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:pointer-events-none disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Äang xá»­ lÃ½..." : "ÄÄƒng nháº­p"}
      </button>
    </form>
  );
}
