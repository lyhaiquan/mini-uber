// @vitest-environment jsdom

import type { RideResponse } from "@ridex/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import * as React from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rideKeys, useCreateRide } from "./use-rides";

import { ridesApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  ridesApi: {
    createRide: vi.fn(),
    transitionRide: vi.fn()
  }
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createRide(overrides: Partial<RideResponse> = {}): RideResponse {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customerId: "22222222-2222-4222-8222-222222222222",
    driverUserId: null,
    status: "REQUESTED",
    pickup: { lat: 10.762622, lng: 106.660172, address: "Ben Thanh" },
    destination: { lat: 10.776889, lng: 106.700806, address: "Thu Thiem" },
    requestedAt: "2026-05-23T05:00:00.000Z",
    matchingStartedAt: null,
    acceptedAt: null,
    driverArrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    version: 0,
    ...overrides
  };
}

describe("use-rides hooks", () => {
  beforeEach(() => {
    vi.mocked(ridesApi.createRide).mockReset();
  });

  it("invalidates active ride and primes detail cache after create", async () => {
    const ride = createRide({
      id: "33333333-3333-4333-8333-333333333333",
      version: 1
    });
    const input = {
      pickup: { lat: 10.762622, lng: 106.660172, address: "Ben Thanh" },
      destination: { lat: 10.776889, lng: 106.700806, address: "Thu Thiem" }
    };
    vi.mocked(ridesApi.createRide).mockResolvedValue(ride);
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRide(), {
      wrapper: createWrapper(queryClient)
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(ridesApi.createRide).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rideKeys.active() });
    expect(queryClient.getQueryData(rideKeys.detail(ride.id))).toEqual(ride);
  });
});
