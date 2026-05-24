import { describe, expect, it } from "vitest";

import { ADMIN_DASHBOARD_REFETCH_INTERVAL_MS } from "./use-admin-dashboard";

describe("useAdminDashboardSummary", () => {
  it("uses the required 30s polling interval", () => {
    expect(ADMIN_DASHBOARD_REFETCH_INTERVAL_MS).toBe(30_000);
  });
});
