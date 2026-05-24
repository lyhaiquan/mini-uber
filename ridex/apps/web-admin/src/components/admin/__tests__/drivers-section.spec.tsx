import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DriversSection } from "../drivers-section";

void React;

describe("DriversSection", () => {
  it("renders online drivers as the emphasis metric", () => {
    const out = renderToStaticMarkup(
      <DriversSection
        loading={false}
        data={{ online: 23, totalRegistered: 95 }}
      />
    );

    expect(out).toMatch(/Tài xế/);
    expect(out).toMatch(/Đang online/);
    expect(out).toMatch(/Tổng đăng ký/);
    expect(out).toMatch(/>23</);
  });
});
