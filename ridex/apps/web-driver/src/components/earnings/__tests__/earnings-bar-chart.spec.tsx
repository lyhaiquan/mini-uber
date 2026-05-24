import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EarningsBarChart } from "../earnings-bar-chart";

void React;

const byDay = [
  { date: "2026-05-17", earningsVnd: 68000, trips: 1 },
  { date: "2026-05-16", earningsVnd: 136000, trips: 2 }
];

describe("EarningsBarChart", () => {
  it("renders a bar for each day", () => {
    const html = renderToStaticMarkup(<EarningsBarChart data={byDay} />);
    expect(html).toMatch(/2026-05-17/);
    expect(html).toMatch(/2026-05-16/);
  });

  it("renders empty state when data is empty", () => {
    const html = renderToStaticMarkup(<EarningsBarChart data={[]} />);
    expect(html).toMatch(/Chưa có dữ liệu/);
  });

  it("shows trip counts", () => {
    const html = renderToStaticMarkup(<EarningsBarChart data={byDay} />);
    expect(html).toMatch(/1/);
    expect(html).toMatch(/2/);
  });
});
