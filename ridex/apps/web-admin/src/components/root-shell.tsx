"use client";

import * as React from "react";

import { AppToaster } from "@/components/app-toaster";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { QueryProvider } from "@/components/query-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";

export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthBootstrap />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <AppToaster />
      </QueryProvider>
    </ThemeProvider>
  );
}
