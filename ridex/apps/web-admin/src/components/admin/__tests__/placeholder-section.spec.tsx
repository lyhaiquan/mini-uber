import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlaceholderSection } from "../placeholder-section";

void React;

describe("PlaceholderSection", () => {
  it("renders placeholder labels when backend values are null", () => {
    const out = renderToStaticMarkup(
      <PlaceholderSection
        loading={false}
        data={{
          matchingDurationMs: { value: null, source: "future" },
          fraudAlerts: { value: null, source: "future" }
        }}
      />
    );

    expect(out).toMatch(/placeholder/);
    expect(out).toMatch(/Sắp ra mắt/);
    expect(out).toMatch(/Cảnh báo gian lận/);
  });
});
