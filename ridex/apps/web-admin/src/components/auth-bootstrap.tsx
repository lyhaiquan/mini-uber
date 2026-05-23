"use client";

import * as React from "react";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

export function AuthBootstrap(): null {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);
  const setStatus = useAuthStore((s) => s.setStatus);

  React.useEffect(() => {
    let cancelled = false;
    setStatus("hydrating");
    void (async () => {
      const result = await authActions.refresh();
      if (cancelled) return;
      if (result.ok) {
        setAuth(result.data);
      } else {
        clear();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAuth, clear, setStatus]);

  return null;
}
