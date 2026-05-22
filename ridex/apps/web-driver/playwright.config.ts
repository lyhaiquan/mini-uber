import { defineConfig, devices } from "@playwright/test";

const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000/api/v1",
      NEXT_PUBLIC_WS_URL: "http://localhost:3000"
    }
  }
});
