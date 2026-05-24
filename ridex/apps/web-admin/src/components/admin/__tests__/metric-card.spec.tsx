import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MetricCard } from "../metric-card";

void React;

// renderToStaticMarkup keeps these unit tests off the jsdom + UI-web Card
// transitive chain that breaks pre-existing on this branch (same workaround
// applied across Task 018/019/020 tests).
describe("MetricCard", () => {
  it("renders the title and badge", () => {
    const out = renderToStaticMarkup(
      <MetricCard title="Chuyến đi" badge="24h" metrics={[]} />
    );
    expect(out).toMatch(/Chuyến đi/);
    expect(out).toMatch(/24h/);
  });

  it("renders the first emphasis metric as the big number", () => {
    const out = renderToStaticMarkup(
      <MetricCard
        title="Tài xế"
        metrics={[
          { label: "Online", value: 23, emphasis: true },
          { label: "Tổng đăng ký", value: 95 }
        ]}
      />
    );
    // Emphasis row uses the big-number wrapper plus a screen-reader label.
    expect(out).toMatch(/text-3xl/);
    expect(out).toMatch(/Online:\s*<\/span>23/);
    // Non-emphasis row still renders in the dl beneath.
    expect(out).toMatch(/Tổng đăng ký/);
    expect(out).toMatch(/>95</);
  });

  it("renders only the dl when no metric is emphasis", () => {
    const out = renderToStaticMarkup(
      <MetricCard
        title="Placeholders"
        metrics={[
          { label: "Matching duration", value: "Sắp ra mắt" },
          { label: "Fraud alerts", value: "Sắp ra mắt" }
        ]}
      />
    );
    expect(out).not.toMatch(/text-3xl/);
    expect(out).toMatch(/Matching duration/);
  });

  it("renders the skeleton when loading is true and hides metrics", () => {
    const out = renderToStaticMarkup(
      <MetricCard
        title="Tải"
        loading
        metrics={[{ label: "Online", value: 23, emphasis: true }]}
      />
    );
    expect(out).toMatch(/metric-card-skeleton/);
    // The emphasis row must not leak through while loading.
    expect(out).not.toMatch(/>23</);
  });

  it("propagates data-section for downstream assertions", () => {
    const out = renderToStaticMarkup(
      <MetricCard title="x" metrics={[]} data-section="rides" />
    );
    expect(out).toMatch(/data-section="rides"/);
  });
});
