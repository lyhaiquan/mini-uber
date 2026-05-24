import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaymentsSection } from "../payments-section";

void React;

describe("PaymentsSection", () => {
  it("renders revenue and success/failure counts", () => {
    const out = renderToStaticMarkup(
      <PaymentsSection
        loading={false}
        data={{
          successCountLast24h: 138,
          failureCountLast24h: 6,
          platformRevenueLast24hVnd: 4_250_000,
          platformRevenueAllTimeVnd: 18_750_000
        }}
      />
    );

    expect(out).toMatch(/Thanh toán/);
    expect(out).toMatch(/Doanh thu 24h/);
    expect(out).toMatch(/Doanh thu tổng/);
    expect(out).toMatch(/Thành công 24h/);
    expect(out).toMatch(/Lỗi 24h/);
    expect(out).toMatch(/4\.250\.000/);
    expect(out).toMatch(/18\.8M|18.8M/);
  });
});
