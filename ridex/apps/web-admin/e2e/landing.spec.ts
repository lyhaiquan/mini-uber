import { expect, test } from "@playwright/test";

test.describe("admin landing", () => {
  test("renders heading + login CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Admin Console");
    await expect(page.getByRole("link", { name: /Đăng nhập quản trị/i })).toBeVisible();
  });

  test("theme toggle applies dark class", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Switch to (dark|light) mode/i });
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("CTA navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Đăng nhập quản trị/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
