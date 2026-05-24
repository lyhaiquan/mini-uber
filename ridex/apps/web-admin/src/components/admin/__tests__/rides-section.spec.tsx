import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RidesSection } from "../rides-section";

void React;

describe("RidesSection", () => {
  it("renders the active rides metric as the headline and the 24h breakdown", () => {
    const out = renderToStaticMarkup(
      <RidesSection
        loading={false}
        data={{
          active: 7,
          completedLast24h: 142,
          cancelledLast24h: 11,
          noDriversFoundLast24h: 3,
          totalLast24h: 156
        }}
      />
    );

    expect(out).toMatch(/Chuy/);
    expect(out).toMatch(/Đang hoạt động/);
    expect(out).toMatch(/Hoàn thành 24h/);
    expect(out).toMatch(/Tổng 24h/);
    expect(out).toMatch(/>7</);
  });
});
