import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TransactionItem } from "../transaction-item";

void React;

const base = {
  id: "p-1",
  rideId: "r-1",
  totalVnd: 85000,
  driverShareVnd: 68000,
  status: "SUCCEEDED" as const,
  failureReason: null,
  createdAt: "2026-05-17T10:00:00.000Z",
  completedAt: "2026-05-17T10:05:00.000Z",
  rideSummary: { pickupAddress: "Bến Thành", destinationAddress: "Tân Sơn Nhất" }
};

describe("TransactionItem (customer)", () => {
  it("renders pickup and destination addresses", () => {
    const html = renderToStaticMarkup(<TransactionItem item={base} />);
    expect(html).toMatch(/Bến Thành/);
    expect(html).toMatch(/Tân Sơn Nhất/);
  });

  it("shows amount with debit prefix for SUCCEEDED", () => {
    const html = renderToStaticMarkup(<TransactionItem item={base} />);
    expect(html).toMatch(/-/);
    expect(html).toMatch(/85/);
  });

  it("shows failure label when status is FAILED_INSUFFICIENT_BALANCE", () => {
    const html = renderToStaticMarkup(
      <TransactionItem
        item={{ ...base, status: "FAILED_INSUFFICIENT_BALANCE", failureReason: "balance" }}
      />
    );
    expect(html).toMatch(/Lỗi/);
  });
});
