import { expect, test } from "@playwright/test";

test.describe("customer landing", () => {
  test("renders hero + CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("RideX");
    await expect(page.getByRole("link", { name: /Đặt xe ngay/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Tạo tài khoản/i })).toBeVisible();
  });

  test("theme toggle applies dark class", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Switch to (dark|light) mode/i });
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("CTA navigates to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Đặt xe ngay/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
