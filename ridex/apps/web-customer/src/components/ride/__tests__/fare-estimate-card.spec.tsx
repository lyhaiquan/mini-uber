// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { FareEstimateCard } from "../fare-estimate-card";

void React;

const baseQuote = {
  distanceMeters: 12500,
  durationSeconds: 1500,
  baseFareVnd: 12000,
  perKmVnd: 5000,
  perMinVnd: 500,
  surgeMultiplier: 1.0,
  totalVnd: 87000,
  currency: "VND" as const,
  routeConfidence: "high" as const,
  estimatedAt: "2026-05-23T05:00:00.000Z",
  expiresInSeconds: 60
};

describe("FareEstimateCard", () => {
  afterEach(() => cleanup());

  it("renders total rounded up to nearest 1000 VND", () => {
    render(<FareEstimateCard quote={{ ...baseQuote, totalVnd: 87100 }} />);
    expect(screen.getByText(/88\.000 ₫/)).not.toBeNull();
  });

  it("renders surge badge when multiplier > 1", () => {
    render(<FareEstimateCard quote={{ ...baseQuote, surgeMultiplier: 1.2 }} />);
    expect(screen.getByText(/Giờ cao điểm ×1\.2/)).not.toBeNull();
  });

  it("hides surge badge when multiplier = 1.0", () => {
    render(<FareEstimateCard quote={baseQuote} />);
    expect(screen.queryByText(/Giờ cao điểm/)).toBeNull();
  });

  it("shows low-confidence notice when routeConfidence='low'", () => {
    render(<FareEstimateCard quote={{ ...baseQuote, routeConfidence: "low" }} />);
    expect(screen.getByText(/Ước tính có thể chênh/)).not.toBeNull();
  });

  it("renders loading skeleton when loading=true", () => {
    render(<FareEstimateCard loading />);
    expect(screen.getByTestId("fare-card-skeleton")).not.toBeNull();
  });
});
