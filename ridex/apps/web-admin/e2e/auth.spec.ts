import { expect, test } from "@playwright/test";

const ADMIN_AUTH = {
  accessToken: "access-token-admin",
  accessTokenExpiresInSeconds: 3600,
  user: {
    id: "55555555-5555-5555-5555-555555555555",
    email: "admin@ridex.test",
    role: "ADMIN"
  }
};

const CUSTOMER_AUTH = {
  accessToken: "access-token-customer",
  accessTokenExpiresInSeconds: 3600,
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "customer@ridex.test",
    role: "CUSTOMER"
  }
};

const DASHBOARD_SUMMARY = {
  data: {
    generatedAt: "2026-05-18T03:14:15.000Z",
    windowHours: 24,
    rides: {
      active: 7,
      completedLast24h: 142,
      cancelledLast24h: 11,
      noDriversFoundLast24h: 3,
      totalLast24h: 156
    },
    drivers: { online: 23, totalRegistered: 95 },
    payments: {
      successCountLast24h: 138,
      failureCountLast24h: 6,
      platformRevenueLast24hVnd: 4_250_000,
      platformRevenueAllTimeVnd: 18_750_000
    },
    placeholders: {
      matchingDurationMs: { value: null, source: "future-task" },
      fraudAlerts: { value: null, source: "future-task" }
    }
  }
};

test.describe("admin auth flow", () => {
  test("admin login redirects to /dashboard and loads summary", async ({ page, context }) => {
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.route("**/api/auth/login", async (route) => {
      await context.addCookies([
        { name: "ridex_refresh", value: "refresh-admin", url: "http://localhost:3003" },
        { name: "ridex_role", value: "ADMIN", url: "http://localhost:3003" }
      ]);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ADMIN_AUTH)
      });
    });
    await page.route("http://localhost:3000/api/v1/admin/dashboard/summary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(DASHBOARD_SUMMARY)
      });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@ridex.test");
    await page.getByLabel("Mật khẩu").fill("secret123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tổng quan vận hành");
  });

  test("non-admin login is redirected away from dashboard access", async ({ page, context }) => {
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.route("**/api/auth/login", async (route) => {
      await context.addCookies([
        { name: "ridex_refresh", value: "refresh-customer", url: "http://localhost:3003" },
        { name: "ridex_role", value: "CUSTOMER", url: "http://localhost:3003" }
      ]);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CUSTOMER_AUTH)
      });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("customer@ridex.test");
    await page.getByLabel("Mật khẩu").fill("secret123");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/403/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("403");
  });

  test("logout from app shell returns to /login", async ({ page, context }) => {
    await context.addCookies([
      { name: "ridex_refresh", value: "refresh-admin", url: "http://localhost:3003" },
      { name: "ridex_role", value: "ADMIN", url: "http://localhost:3003" }
    ]);
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ADMIN_AUTH)
      });
    });
    await page.route("http://localhost:3000/api/v1/admin/dashboard/summary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(DASHBOARD_SUMMARY)
      });
    });
    await page.route("**/api/auth/logout", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tổng quan vận hành");
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
