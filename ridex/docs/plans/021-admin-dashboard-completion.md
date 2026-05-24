# T021 Admin Dashboard — Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the gaps left in T021 admin dashboard so the page ships with the full sidebar+top-bar shell, ADMIN role guard, and the test coverage the spec calls for.

**Architecture:** Dashboard page + sections + `useAdminDashboardSummary` hook + format helpers + 4 placeholder routes are already in place. This plan adds (1) `(app)/layout.tsx` shell with sidebar + top bar, (2) page-level ADMIN role guard reused across `/dashboard` and the 3 placeholder pages via a shared `useRequireAdmin()` hook, (3) `refetchOnWindowFocus: true` on the dashboard query, (4) the missing component/hook tests, (5) Playwright E2E for login→dashboard / non-admin→403 / logout. Login post-success redirect moves from `/home` to `/dashboard`.

**Tech Stack:** Next.js 15 App Router, React 18, TanStack Query v5, Zustand auth store, `@ridex/ui-web` components, Vitest + `renderToStaticMarkup` for component tests, Playwright for E2E.

---

## Existing State (do not re-do)

Already in `apps/web-admin/src/`:
- `app/(app)/dashboard/page.tsx` — wires sections, error/empty states, last-updated pill ✅
- `app/(app)/{rides,drivers,payments}/page.tsx` — placeholder pages ✅
- `components/admin/{metric-card,rides-section,drivers-section,payments-section,placeholder-section,last-updated-pill}.tsx` ✅
- `hooks/use-admin-dashboard.ts` (missing `refetchOnWindowFocus`) ⚠️
- `lib/format.ts` + `lib/__tests__/format.spec.ts` ✅
- `components/admin/__tests__/metric-card.spec.tsx` ✅
- `app/(app)/home/page.tsx` — has working `useRequireAdmin` pattern inline; will be DRYed into a shared hook ⚠️

Gaps this plan fills:
- Sidebar + top bar + layout shell.
- `useRequireAdmin()` shared hook + apply to `/dashboard`, `/rides`, `/drivers`, `/payments`.
- `refetchOnWindowFocus: true` on dashboard query.
- Component tests for `rides-section`, `drivers-section`, `payments-section`, `placeholder-section`, `last-updated-pill`.
- Hook test for `useAdminDashboardSummary` (queryKey + refetchInterval + refetchOnWindowFocus).
- Login redirect: `/home` → `/dashboard`.
- Sidebar component test (active-route highlight, logout wiring).
- E2E: `admin-dashboard.spec.ts` (login → dashboard → logout) + `non-admin-blocked.spec.ts`.

---

## File Structure

**Create:**
- `apps/web-admin/src/components/admin/sidebar.tsx`
- `apps/web-admin/src/components/admin/top-bar.tsx`
- `apps/web-admin/src/hooks/use-require-admin.ts`
- `apps/web-admin/src/hooks/__tests__/use-admin-dashboard.spec.ts`
- `apps/web-admin/src/components/admin/__tests__/sidebar.spec.tsx`
- `apps/web-admin/src/components/admin/__tests__/rides-section.spec.tsx`
- `apps/web-admin/src/components/admin/__tests__/drivers-section.spec.tsx`
- `apps/web-admin/src/components/admin/__tests__/payments-section.spec.tsx`
- `apps/web-admin/src/components/admin/__tests__/placeholder-section.spec.tsx`
- `apps/web-admin/src/components/admin/__tests__/last-updated-pill.spec.tsx`
- `apps/web-admin/e2e/admin-dashboard.spec.ts`
- `apps/web-admin/e2e/non-admin-blocked.spec.ts`

**Modify:**
- `apps/web-admin/src/app/(app)/layout.tsx` — replace max-width wrapper with sidebar + top-bar shell.
- `apps/web-admin/src/app/(app)/dashboard/page.tsx` — call `useRequireAdmin()`.
- `apps/web-admin/src/app/(app)/{rides,drivers,payments}/page.tsx` — call `useRequireAdmin()`.
- `apps/web-admin/src/app/(app)/home/page.tsx` — DRY: replace inline effect with `useRequireAdmin()`.
- `apps/web-admin/src/app/(auth)/login/page.tsx:36` — change `/home` → `/dashboard`.
- `apps/web-admin/src/hooks/use-admin-dashboard.ts` — add `refetchOnWindowFocus: true`.

**No backend or schema changes.**

---

## Conventions

- **Component tests**: use `renderToStaticMarkup` from `react-dom/server`, NOT `@testing-library/react`. Vitest `environment: node`. Pattern: see `apps/web-admin/src/components/admin/__tests__/metric-card.spec.tsx`.
- **Hook tests**: TanStack Query options are pure data — extract a `dashboardQueryOptions()` factory and assert its shape. Do NOT try to render the hook (would need jsdom + workspace React dedup — see `docs/tasks/024-driver-e2e-maestro.md` for why this is blocked).
- **E2E**: Playwright (already configured — see `apps/web-driver/playwright.config.ts` for the project pattern, or check `apps/web-admin/` for existing config).
- **Commits**: one per task. Convention: `feat(021): <subject>` or `test(021): <subject>` matching recent log style.

---

## Task 1 — `useRequireAdmin()` shared hook

**Files:**
- Create: `apps/web-admin/src/hooks/use-require-admin.ts`
- Test: (no test — covered indirectly by E2E and page-level usage; the hook is thin glue around `useAuthStore` + `useRouter`)

- [ ] **Step 1: Write the hook**

```typescript
// apps/web-admin/src/hooks/use-require-admin.ts
"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/lib/auth-store";

export type RequireAdminState =
  | { status: "loading" }
  | { status: "ready"; email: string };

// Page-level role guard for admin routes. Mirrors the inline effect that
// shipped with /home in T012/T014 but centralized so /dashboard, /rides,
// /drivers, /payments don't each re-implement the same redirect dance.
// Returns "loading" until the auth store has hydrated; pages should render
// a generic "Đang tải..." placeholder during that window.
export function useRequireAdmin(): RequireAdminState {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && user && user.role !== "ADMIN") {
      router.replace("/403");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user || user.role !== "ADMIN") {
    return { status: "loading" };
  }
  return { status: "ready", email: user.email };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-admin/src/hooks/use-require-admin.ts
git commit -m "feat(021): extract useRequireAdmin shared role guard"
```

---

## Task 2 — Apply `useRequireAdmin()` to dashboard + placeholder pages

**Files:**
- Modify: `apps/web-admin/src/app/(app)/dashboard/page.tsx`
- Modify: `apps/web-admin/src/app/(app)/rides/page.tsx`
- Modify: `apps/web-admin/src/app/(app)/drivers/page.tsx`
- Modify: `apps/web-admin/src/app/(app)/payments/page.tsx`
- Modify: `apps/web-admin/src/app/(app)/home/page.tsx` (DRY the existing inline guard)

- [ ] **Step 1: Wire dashboard**

Edit `apps/web-admin/src/app/(app)/dashboard/page.tsx`:

```typescript
// at top of file, after existing imports
import { useRequireAdmin } from "@/hooks/use-require-admin";

// inside DashboardPage(), before the existing useAdminDashboardSummary call:
const guard = useRequireAdmin();
if (guard.status === "loading") {
  return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
}
```

- [ ] **Step 2: Apply same pattern to rides/drivers/payments placeholder pages**

For each of `rides/page.tsx`, `drivers/page.tsx`, `payments/page.tsx`, add at the top of the component body:

```typescript
const guard = useRequireAdmin();
if (guard.status === "loading") {
  return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
}
```

Plus the import:

```typescript
import { useRequireAdmin } from "@/hooks/use-require-admin";
```

- [ ] **Step 3: DRY home page**

Edit `apps/web-admin/src/app/(app)/home/page.tsx` — replace the inline `React.useEffect` + status checks with `useRequireAdmin()`:

```typescript
"use client";

import { Card, CardContent, CardDescription, CardTitle } from "@ridex/ui-web";
import * as React from "react";

import { useRequireAdmin } from "@/hooks/use-require-admin";

void React;

export default function AdminHomePage() {
  const guard = useRequireAdmin();
  if (guard.status === "loading") {
    return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bảng điều khiển</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Admin: <strong>{guard.email}</strong>
        </p>
      </header>

      <Card>
        <CardContent className="space-y-2 p-6">
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Đi tới{" "}
            <a className="underline" href="/dashboard">
              /dashboard
            </a>{" "}
            để xem số liệu vận hành.
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 4: Run existing tests**

```bash
pnpm --filter @ridex/web-admin test
```

Expected: all previously passing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web-admin/src/app/\(app\)/
git commit -m "feat(021): apply useRequireAdmin to dashboard + placeholder pages"
```

---

## Task 3 — Login redirect target `/home` → `/dashboard`

**Files:**
- Modify: `apps/web-admin/src/app/(auth)/login/page.tsx:36`

- [ ] **Step 1: Change the redirect**

Edit the redirect target so successful login lands on the dashboard per spec ("Admin login → redirect /dashboard"):

```typescript
router.replace("/dashboard");
```

(Replace the existing `router.replace("/home")` on the success branch — line ~36.)

- [ ] **Step 2: Commit**

```bash
git add apps/web-admin/src/app/\(auth\)/login/page.tsx
git commit -m "feat(021): redirect admin login to /dashboard"
```

---

## Task 4 — Add `refetchOnWindowFocus: true` to dashboard query

**Files:**
- Modify: `apps/web-admin/src/hooks/use-admin-dashboard.ts`

Per spec ("`useDashboardSummary` query với `refetchInterval: 30_000` + `refetchOnWindowFocus: true`"), the focus refetch is missing.

- [ ] **Step 1: Update hook**

```typescript
"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { adminApi } from "@/lib/api";

export const adminKeys = {
  all: ["admin"] as const,
  dashboardSummary: () => [...adminKeys.all, "dashboard", "summary"] as const
};

// Pure options factory so tests can assert queryKey / refetch settings
// without rendering React (workspace pnpm has two React versions, so
// renderHook is blocked — see docs/tasks/024-driver-e2e-maestro.md).
export function dashboardSummaryQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.dashboardSummary(),
    queryFn: () => adminApi.getDashboardSummary(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true
  });
}

export function useAdminDashboardSummary() {
  return useQuery(dashboardSummaryQueryOptions());
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-admin/src/hooks/use-admin-dashboard.ts
git commit -m "feat(021): enable refetchOnWindowFocus on dashboard summary"
```

---

## Task 5 — Hook test for `dashboardSummaryQueryOptions`

**Files:**
- Create: `apps/web-admin/src/hooks/__tests__/use-admin-dashboard.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web-admin/src/hooks/__tests__/use-admin-dashboard.spec.ts
import { describe, expect, it } from "vitest";

import {
  adminKeys,
  dashboardSummaryQueryOptions
} from "../use-admin-dashboard";

describe("dashboardSummaryQueryOptions", () => {
  it("uses the admin/dashboard/summary query key", () => {
    const opts = dashboardSummaryQueryOptions();
    expect(opts.queryKey).toEqual(adminKeys.dashboardSummary());
    expect(opts.queryKey).toEqual(["admin", "dashboard", "summary"]);
  });

  it("polls every 30 seconds per spec", () => {
    const opts = dashboardSummaryQueryOptions();
    expect(opts.refetchInterval).toBe(30_000);
  });

  it("refetches on window focus so a re-focused tab catches up immediately", () => {
    const opts = dashboardSummaryQueryOptions();
    expect(opts.refetchOnWindowFocus).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — should pass already since Task 4 added the options**

```bash
pnpm --filter @ridex/web-admin test src/hooks/__tests__/use-admin-dashboard.spec.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web-admin/src/hooks/__tests__/use-admin-dashboard.spec.ts
git commit -m "test(021): cover dashboard query options shape"
```

---

## Task 6 — Sidebar component

**Files:**
- Create: `apps/web-admin/src/components/admin/sidebar.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/web-admin/src/components/admin/sidebar.tsx
"use client";

import { Button } from "@ridex/ui-web";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { authActions } from "@/lib/auth-actions";
import { useAuthStore } from "@/lib/auth-store";

void React;

interface NavItem {
  href: string;
  label: string;
}

// Order matches the spec sidebar layout (Tổng quan first, logout last).
const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/dashboard", label: "Tổng quan" },
  { href: "/rides", label: "Chuyến đi" },
  { href: "/drivers", label: "Tài xế" },
  { href: "/payments", label: "Thanh toán" }
];

export function AdminSidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  return (
    <aside
      className="hidden w-56 shrink-0 flex-col gap-1 border-r border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-950 md:flex"
      data-testid="admin-sidebar"
    >
      <Link
        href="/dashboard"
        className="mb-4 text-lg font-semibold tracking-tight"
      >
        RideX Admin
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active ? "true" : "false"}
              className={
                active
                  ? "rounded bg-surface-200 px-3 py-2 text-sm font-medium dark:bg-surface-800"
                  : "rounded px-3 py-2 text-sm text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-900"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={async () => {
            await authActions.logout();
            clear();
            router.replace("/login");
          }}
        >
          Đăng xuất
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-admin/src/components/admin/sidebar.tsx
git commit -m "feat(021): add admin sidebar with nav + logout"
```

---

## Task 7 — Sidebar test

**Files:**
- Create: `apps/web-admin/src/components/admin/__tests__/sidebar.spec.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web-admin/src/components/admin/__tests__/sidebar.spec.tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

void React;

// next/navigation must be mocked because renderToStaticMarkup runs outside
// the Next router context. usePathname is the only call the component makes
// at render time (logout fires on click, not on render).
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn() })
}));

import { AdminSidebar } from "../sidebar";

describe("AdminSidebar", () => {
  it("renders all spec nav items + logout button", () => {
    const out = renderToStaticMarkup(<AdminSidebar />);
    expect(out).toMatch(/Tổng quan/);
    expect(out).toMatch(/Chuyến đi/);
    expect(out).toMatch(/Tài xế/);
    expect(out).toMatch(/Thanh toán/);
    expect(out).toMatch(/Đăng xuất/);
  });

  it("marks the active nav item via data-active='true'", () => {
    const out = renderToStaticMarkup(<AdminSidebar />);
    // /dashboard is active per the mocked pathname above
    expect(out).toMatch(/href="\/dashboard"[^>]*data-active="true"/);
    // Other items must not be active
    expect(out).toMatch(/href="\/rides"[^>]*data-active="false"/);
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @ridex/web-admin test src/components/admin/__tests__/sidebar.spec.tsx
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web-admin/src/components/admin/__tests__/sidebar.spec.tsx
git commit -m "test(021): cover sidebar nav rendering + active highlight"
```

---

## Task 8 — Top bar component

**Files:**
- Create: `apps/web-admin/src/components/admin/top-bar.tsx`

Top bar shows the current admin email + a theme toggle (matching the site-header pattern). Logout already lives in the sidebar.

- [ ] **Step 1: Write the component**

```typescript
// apps/web-admin/src/components/admin/top-bar.tsx
"use client";

import * as React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/lib/auth-store";

void React;

export function AdminTopBar(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  return (
    <header
      className="flex h-12 items-center justify-between border-b border-surface-200 px-4 dark:border-surface-800"
      data-testid="admin-top-bar"
    >
      <span className="text-xs text-surface-600 dark:text-surface-400">
        {user ? `${user.email} · ${user.role}` : ""}
      </span>
      <ThemeToggle />
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-admin/src/components/admin/top-bar.tsx
git commit -m "feat(021): add admin top bar"
```

---

## Task 9 — Layout shell wires sidebar + top bar

**Files:**
- Modify: `apps/web-admin/src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace the wrapper layout**

```typescript
// apps/web-admin/src/app/(app)/layout.tsx
import * as React from "react";

import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopBar } from "@/components/admin/top-bar";

void React;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server briefly to eyeball the shell**

```bash
pnpm --filter @ridex/web-admin dev
```

Open http://localhost:3003 (or whichever port the script logs), log in as an admin, confirm sidebar shows on the left at md+ widths, top bar shows the user email, and clicking nav items navigates without full reload. Then `Ctrl+C` the dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/web-admin/src/app/\(app\)/layout.tsx
git commit -m "feat(021): wire admin layout shell with sidebar + top bar"
```

---

## Task 10 — `LastUpdatedPill` test

**Files:**
- Create: `apps/web-admin/src/components/admin/__tests__/last-updated-pill.spec.tsx`

Open the component first to confirm its prop shape:

```bash
cat apps/web-admin/src/components/admin/last-updated-pill.tsx
```

The component takes `dataUpdatedAt: number` (TanStack Query's epoch millis) and renders a relative-time string like "Cập nhật 5s trước" / "1 phút trước".

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web-admin/src/components/admin/__tests__/last-updated-pill.spec.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { LastUpdatedPill } from "../last-updated-pill";

void React;

describe("LastUpdatedPill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a seconds-ago label when the last update was <60s ago", () => {
    const out = renderToStaticMarkup(
      <LastUpdatedPill dataUpdatedAt={Date.now() - 5_000} />
    );
    expect(out).toMatch(/Cập nhật.*5\s*s/i);
  });

  it("renders a minutes-ago label when the last update was >=60s ago", () => {
    const out = renderToStaticMarkup(
      <LastUpdatedPill dataUpdatedAt={Date.now() - 3 * 60_000} />
    );
    expect(out).toMatch(/Cập nhật.*3\s*phút/i);
  });

  it("renders a placeholder when dataUpdatedAt is 0 (never fetched)", () => {
    const out = renderToStaticMarkup(<LastUpdatedPill dataUpdatedAt={0} />);
    // Implementation-defined fallback — assert non-empty and free of "NaN".
    expect(out).not.toMatch(/NaN/);
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @ridex/web-admin test src/components/admin/__tests__/last-updated-pill.spec.tsx
```

If the component's output text doesn't match, adjust the regex (don't change the component). If the placeholder case fails, read the component and weaken or tighten the assertion to match its real fallback behavior.

- [ ] **Step 3: Commit**

```bash
git add apps/web-admin/src/components/admin/__tests__/last-updated-pill.spec.tsx
git commit -m "test(021): cover LastUpdatedPill relative-time output"
```

---

## Task 11 — Section component tests

**Files:**
- Create: `apps/web-admin/src/components/admin/__tests__/rides-section.spec.tsx`
- Create: `apps/web-admin/src/components/admin/__tests__/drivers-section.spec.tsx`
- Create: `apps/web-admin/src/components/admin/__tests__/payments-section.spec.tsx`
- Create: `apps/web-admin/src/components/admin/__tests__/placeholder-section.spec.tsx`

Open each section component first to confirm the prop shape it expects (it should match the backend `GET /admin/dashboard/summary` envelope):

```bash
cat apps/web-admin/src/components/admin/rides-section.tsx
cat apps/web-admin/src/components/admin/drivers-section.tsx
cat apps/web-admin/src/components/admin/payments-section.tsx
cat apps/web-admin/src/components/admin/placeholder-section.tsx
```

For each section, use the same template below. The exact field names depend on what the component reads — adjust each fixture to match.

- [ ] **Step 1: `rides-section.spec.tsx`**

```typescript
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { RidesSection } from "../rides-section";

void React;

describe("RidesSection", () => {
  it("renders the three ride metrics from the summary payload", () => {
    const out = renderToStaticMarkup(
      <RidesSection
        loading={false}
        data={{ active: 7, totalLast24h: 142, cancelledLast24h: 11 }}
      />
    );
    // Big-number emphasis for active rides
    expect(out).toMatch(/>7</);
    // Secondary metrics in the dl
    expect(out).toMatch(/>142</);
    expect(out).toMatch(/>11</);
  });

  it("forwards loading=true to MetricCard skeleton", () => {
    const out = renderToStaticMarkup(<RidesSection loading data={null} />);
    expect(out).toMatch(/metric-card-skeleton/);
  });

  it("renders without crashing when data is null and loading is false", () => {
    const out = renderToStaticMarkup(<RidesSection loading={false} data={null} />);
    expect(out).toMatch(/Chuyến đi/);
  });
});
```

- [ ] **Step 2: `drivers-section.spec.tsx`**

```typescript
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { DriversSection } from "../drivers-section";

void React;

describe("DriversSection", () => {
  it("renders the online + total registered metrics", () => {
    const out = renderToStaticMarkup(
      <DriversSection
        loading={false}
        data={{ online: 23, totalRegistered: 95 }}
      />
    );
    expect(out).toMatch(/>23</);
    expect(out).toMatch(/>95</);
  });

  it("forwards loading to skeleton", () => {
    const out = renderToStaticMarkup(<DriversSection loading data={null} />);
    expect(out).toMatch(/metric-card-skeleton/);
  });

  it("renders title even when data is null", () => {
    const out = renderToStaticMarkup(<DriversSection loading={false} data={null} />);
    expect(out).toMatch(/Tài xế/);
  });
});
```

- [ ] **Step 3: `payments-section.spec.tsx`**

```typescript
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { PaymentsSection } from "../payments-section";

void React;

describe("PaymentsSection", () => {
  it("renders revenue formatted in vi-VN locale", () => {
    const out = renderToStaticMarkup(
      <PaymentsSection
        loading={false}
        data={{
          revenueLast24hVnd: 4_250_000,
          revenueAllTimeVnd: 18_750_000,
          successCountLast24h: 138,
          failureCountLast24h: 6
        }}
      />
    );
    // vi-VN groups with "." (Intl), accept both formatted forms — pinning the
    // exact glyph would couple the test to Node ICU version.
    expect(out).toMatch(/4[.,\s]?250[.,\s]?000/);
    expect(out).toMatch(/>138</);
    expect(out).toMatch(/>6</);
  });

  it("forwards loading to skeleton", () => {
    const out = renderToStaticMarkup(<PaymentsSection loading data={null} />);
    expect(out).toMatch(/metric-card-skeleton/);
  });
});
```

- [ ] **Step 4: `placeholder-section.spec.tsx`**

```typescript
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { PlaceholderSection } from "../placeholder-section";

void React;

describe("PlaceholderSection", () => {
  it("renders the 'Sắp ra mắt' labels when backend returns null placeholders", () => {
    const out = renderToStaticMarkup(
      <PlaceholderSection loading={false} data={null} />
    );
    expect(out).toMatch(/Sắp ra mắt|sắp ra mắt|Sẽ có sau/i);
  });

  it("renders a real value if a placeholder field becomes populated", () => {
    // When T023 ships matching duration, the placeholder turns into a real
    // number. This guards the contract.
    const out = renderToStaticMarkup(
      <PlaceholderSection
        loading={false}
        data={{
          matchingDurationMs: { value: 1234 },
          fraudAlerts: null
        }}
      />
    );
    expect(out).toMatch(/1[.,\s]?234/);
  });

  it("forwards loading to skeleton", () => {
    const out = renderToStaticMarkup(<PlaceholderSection loading data={null} />);
    expect(out).toMatch(/metric-card-skeleton/);
  });
});
```

- [ ] **Step 5: Run all four section tests**

```bash
pnpm --filter @ridex/web-admin test src/components/admin/__tests__/
```

Expected: all pass. If any test fails because the section's prop shape differs from the fixture I wrote, fix the FIXTURE in the test (not the component) — the component's existing shape is the truth.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/components/admin/__tests__/
git commit -m "test(021): cover dashboard section components"
```

---

## Task 12 — E2E: admin login → dashboard → logout

**Files:**
- Create: `apps/web-admin/e2e/admin-dashboard.spec.ts`

First, confirm Playwright is configured for web-admin:

```bash
ls apps/web-admin/playwright.config.* 2>/dev/null && cat apps/web-admin/playwright.config.ts
```

If no config exists, copy from `apps/web-driver/playwright.config.ts` (the team's existing pattern) and adjust the `webServer.command` to `pnpm --filter @ridex/web-admin dev` and the base URL port to whichever port web-admin runs on. Add `"e2e": "playwright test"` and `"e2e:install": "playwright install --with-deps chromium"` to `apps/web-admin/package.json` if not present (mirror web-driver).

The seed assumption: there is an admin account already in dev DB. Check how `apps/web-driver/e2e/*.spec.ts` or `apps/web-customer/e2e/*` handle login fixtures and copy the pattern. If no admin seed script exists, the prerequisite is to add one — but that is OUT of scope for this plan; flag it as a follow-up if missing.

- [ ] **Step 1: Write the E2E**

```typescript
// apps/web-admin/e2e/admin-dashboard.spec.ts
import { expect, test } from "@playwright/test";

// Prereq: dev backend running with seed admin account.
// Email/password come from env vars to avoid hard-coding credentials.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@ridex.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin12345";

test.describe("admin dashboard", () => {
  test("login → dashboard with all four sections → logout", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/mật khẩu|password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập|log\s*in/i }).click();

    // T021 spec: successful admin login lands on /dashboard
    await page.waitForURL("**/dashboard");

    // All four spec sections render
    await expect(page.getByRole("heading", { name: /tổng quan vận hành/i })).toBeVisible();
    await expect(page.getByText(/chuyến đi/i).first()).toBeVisible();
    await expect(page.getByText(/tài xế/i).first()).toBeVisible();
    await expect(page.getByText(/thanh toán/i).first()).toBeVisible();
    // Last-updated pill
    await expect(page.getByText(/cập nhật/i)).toBeVisible();

    // Sidebar visible on desktop viewport
    await expect(page.getByTestId("admin-sidebar")).toBeVisible();

    // Logout via sidebar lands on /login
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await page.waitForURL("**/login");
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-admin/e2e/admin-dashboard.spec.ts
git commit -m "test(021): e2e admin dashboard happy path"
```

---

## Task 13 — E2E: non-admin → 403

**Files:**
- Create: `apps/web-admin/e2e/non-admin-blocked.spec.ts`

- [ ] **Step 1: Write the E2E**

```typescript
// apps/web-admin/e2e/non-admin-blocked.spec.ts
import { expect, test } from "@playwright/test";

// Prereq: dev backend has at least one non-admin (CUSTOMER or DRIVER) account.
const NON_ADMIN_EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? "customer@ridex.local";
const NON_ADMIN_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD ?? "customer12345";

test.describe("non-admin guard", () => {
  test("customer login on web-admin → /403", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(NON_ADMIN_EMAIL);
    await page.getByLabel(/mật khẩu|password/i).fill(NON_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập|log\s*in/i }).click();

    // useRequireAdmin / login page must redirect non-admin to /403
    await page.waitForURL("**/403");
    await expect(page.getByText(/quyền|forbidden|403/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-admin/e2e/non-admin-blocked.spec.ts
git commit -m "test(021): e2e non-admin redirected to 403"
```

---

## Task 14 — Full suite green-bar check

- [ ] **Step 1: Run lint + unit + build**

```bash
pnpm --filter @ridex/web-admin lint
pnpm --filter @ridex/web-admin test
pnpm --filter @ridex/web-admin build
```

Expected: all three green.

- [ ] **Step 2: Run E2E (optional — requires backend + seed)**

```bash
# Terminal 1
pnpm --filter @ridex/backend start:dev
# Terminal 2
pnpm --filter @ridex/web-admin e2e
```

Expected: both E2E tests pass. If a test fails because the seed admin/customer accounts don't exist, that's a pre-existing seeding gap — file as follow-up, do not bypass auth in the test.

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git status
# If anything's still dirty, inspect and commit with: chore(021): <subject>
```

---

## Acceptance Mapping (T021 spec → tasks)

| Spec line | Task |
|---|---|
| Sidebar nav | Task 6, 9 |
| Dashboard layout (4 sections) | already done — verified in Task 11 tests |
| Auto-refresh 30s | Task 4 + Task 5 test |
| `refetchOnWindowFocus: true` | Task 4 + Task 5 test |
| Last updated pill | Task 10 |
| Format helpers vi-VN | already done (`lib/__tests__/format.spec.ts`) |
| Role guard ADMIN | Task 1, 2 |
| Loading skeleton | covered in section tests (Task 11) |
| Error state | already done in `dashboard/page.tsx` |
| Empty state | already done in `dashboard/page.tsx` |
| Admin login → /dashboard | Task 3 |
| Component tests | Task 7, 10, 11 (sidebar, pill, sections) |
| Hook test | Task 5 |
| E2E happy path | Task 12 |
| E2E non-admin → redirect | Task 13 |
| E2E logout | Task 12 (combined) |
| Lint + build + test xanh | Task 14 |

---

## Out of Scope (per T021 spec — do not add)

- Charts / time-series, list endpoints, filter / time-range picker, CSV export, real-time WS updates, multi-tenant, audit log viewer, admin actions, mobile-admin, EN i18n.
- E2E seed script for admin/customer accounts — if missing, flag as follow-up, do not bypass auth.
- Migrating to `@testing-library/react` — workspace's dual-React state makes this a separate refactor (see `docs/tasks/024-driver-e2e-maestro.md` for context).
