// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRideQuote } from "../use-ride-quote";
import { ridesApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  ridesApi: {
    getQuote: vi.fn()
  }
}));

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useRideQuote", () => {
  beforeEach(() => {
    vi.mocked(ridesApi.getQuote).mockReset();
  });

  it("does not fetch when pickup or destination missing", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useRideQuote({ pickup: null, destination: null }),
      { wrapper: wrapper(qc) }
    );
    expect(result.current.isFetching).toBe(false);
    expect(ridesApi.getQuote).not.toHaveBeenCalled();
  });

  it("fetches quote when both pickup and destination present", async () => {
    vi.mocked(ridesApi.getQuote).mockResolvedValue({
      distanceMeters: 12500,
      durationSeconds: 1500,
      baseFareVnd: 12000,
      perKmVnd: 5000,
      perMinVnd: 500,
      surgeMultiplier: 1.2,
      totalVnd: 105000,
      currency: "VND",
      routeConfidence: "high",
      estimatedAt: "2026-05-23T05:00:00.000Z",
      expiresInSeconds: 60
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () =>
        useRideQuote({
          pickup: { lat: 10.7, lng: 106.7 },
          destination: { lat: 10.8, lng: 106.6 }
        }),
      { wrapper: wrapper(qc) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalVnd).toBe(105000);
  });
});
