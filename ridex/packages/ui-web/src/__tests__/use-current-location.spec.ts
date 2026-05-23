/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SAIGON_FALLBACK,
  useCurrentLocation
} from "../components/map/use-current-location";

const originalGeolocation = (globalThis.navigator as Navigator & {
  geolocation?: Geolocation;
}).geolocation;

function setGeolocation(impl: Partial<Geolocation> | null) {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: impl
  });
}

afterEach(() => {
  setGeolocation(originalGeolocation ?? null);
  vi.restoreAllMocks();
});

describe("useCurrentLocation", () => {
  beforeEach(() => {
    setGeolocation({
      getCurrentPosition: vi.fn()
    } as Partial<Geolocation> as Geolocation);
  });

  it("returns SG fallback when geolocation is unsupported", async () => {
    setGeolocation(null);
    const { result } = renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.status).toBe("unsupported"));
    expect(result.current.coords).toEqual(SAIGON_FALLBACK);
    expect(result.current.isFallback).toBe(true);
  });

  it("transitions to ready on success", async () => {
    const getCurrentPosition = vi.fn((onSuccess: PositionCallback) => {
      onSuccess({
        coords: {
          latitude: 21.0285,
          longitude: 105.8542,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      } as GeolocationPosition);
    });
    setGeolocation({ getCurrentPosition } as Partial<Geolocation> as Geolocation);

    const { result } = renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.coords).toEqual({ lat: 21.0285, lng: 105.8542 });
    expect(result.current.isFallback).toBe(false);
  });

  it("falls back when permission is denied", async () => {
    const getCurrentPosition = vi.fn(
      (_s: PositionCallback, onError: PositionErrorCallback) => {
        onError({
          code: 1,
          message: "denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        } as GeolocationPositionError);
      }
    );
    setGeolocation({ getCurrentPosition } as Partial<Geolocation> as Geolocation);

    const { result } = renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.status).toBe("denied"));
    expect(result.current.coords).toEqual(SAIGON_FALLBACK);
    expect(result.current.isFallback).toBe(true);
  });
});
