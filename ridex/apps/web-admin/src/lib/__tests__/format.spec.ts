import { describe, expect, it } from "vitest";

import {
  formatCompactVnd,
  formatNumber,
  formatRelativeFromNow,
  formatVnd
} from "../format";

describe("formatVnd", () => {
  // Intl in Node sometimes uses NBSP ( ) as a thousands separator; assert
  // the digits and currency without locking down the exact whitespace.
  it("includes the digits and the ₫ symbol with no fractional part", () => {
    const out = formatVnd(1_234_567);
    expect(out.replace(/\s/g, "")).toMatch(/1\.234\.567₫/);
    expect(out).not.toMatch(/[,.]00/);
  });

  it("formats zero correctly", () => {
    expect(formatVnd(0).replace(/\s/g, "")).toMatch(/0₫/);
  });
});

describe("formatCompactVnd", () => {
  it("renders ≥1M as 'XM ₫' or 'X.XM ₫'", () => {
    expect(formatCompactVnd(4_250_000)).toBe("4.3M ₫");
    expect(formatCompactVnd(18_750_000)).toBe("18.8M ₫");
    // Whole millions display without a trailing '.0'.
    expect(formatCompactVnd(2_000_000)).toBe("2M ₫");
  });

  it("renders ≥1K and <1M as 'XK ₫'", () => {
    expect(formatCompactVnd(85_000)).toBe("85K ₫");
    expect(formatCompactVnd(1_499)).toBe("1K ₫");
  });

  it("falls back to the full format below 1K", () => {
    expect(formatCompactVnd(850).replace(/\s/g, "")).toMatch(/850₫/);
  });
});

describe("formatNumber", () => {
  it("uses the vi-VN thousands separator", () => {
    expect(formatNumber(12345)).toBe("12.345");
  });
});

describe("formatRelativeFromNow", () => {
  // Boundaries matter more than absolute values — these are the thresholds
  // the dashboard pill reads as "still fresh" vs "stale".
  const now = 1_700_000_000_000;
  it("collapses sub-5s deltas into 'vừa cập nhật'", () => {
    expect(formatRelativeFromNow(now - 4_000, now)).toBe("vừa cập nhật");
  });
  it("renders 5s..59s in seconds", () => {
    expect(formatRelativeFromNow(now - 30_000, now)).toBe("30s trước");
  });
  it("renders 60s+ in minutes", () => {
    expect(formatRelativeFromNow(now - 5 * 60_000, now)).toBe("5 phút trước");
  });
  it("renders 60min+ in hours", () => {
    expect(formatRelativeFromNow(now - 2 * 3_600_000, now)).toBe("2 giờ trước");
  });
});
