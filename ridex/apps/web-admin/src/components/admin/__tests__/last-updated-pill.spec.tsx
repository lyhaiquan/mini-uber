import { describe, expect, it } from "vitest";

import { getLastUpdatedLabel } from "../last-updated-pill";

describe("LastUpdatedPill", () => {
  it("renders the empty label before the first successful fetch", () => {
    expect(getLastUpdatedLabel(0, 1_700_000_000_000)).toBe("Chưa có dữ liệu");
  });

  it("renders a relative freshness label after data arrives", () => {
    expect(getLastUpdatedLabel(1_700_000_000_000, 1_700_000_030_000)).toBe(
      "Cập nhật 30s trước"
    );
  });
});
