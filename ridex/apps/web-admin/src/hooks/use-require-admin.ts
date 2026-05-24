"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/lib/auth-store";

export interface UseRequireAdminResult {
  ready: boolean;
}

export function useRequireAdmin(): UseRequireAdminResult {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated" && user?.role !== "ADMIN") {
      router.replace("/403");
    }
  }, [router, status, user]);

  return { ready: status === "authenticated" && user?.role === "ADMIN" };
}
