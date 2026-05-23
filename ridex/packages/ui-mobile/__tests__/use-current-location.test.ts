import { renderHook, waitFor } from "@testing-library/react";
import * as Location from "expo-location";

import { SAIGON_FALLBACK } from "../src/components/map/types";
import { useCurrentLocation } from "../src/components/map/use-current-location";

const getMock = Location.getForegroundPermissionsAsync as jest.Mock;
const reqMock = Location.requestForegroundPermissionsAsync as jest.Mock;
const posMock = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  getMock.mockReset();
  reqMock.mockReset();
  posMock.mockReset();
});

describe("useCurrentLocation", () => {
  it("returns real coords when permission already granted", async () => {
    getMock.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
      granted: true,
      canAskAgain: true,
      expires: "never"
    });
    posMock.mockResolvedValue({
      coords: {
        latitude: 21.0285,
        longitude: 105.8542,
        altitude: null,
        accuracy: 5,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    });
    const { result } = renderHook(() => useCurrentLocation({ autoRequest: false }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.coords).toEqual({ lat: 21.0285, lng: 105.8542 });
    expect(result.current.isFallback).toBe(false);
  });

  it("falls back to Sài Gòn when denied", async () => {
    getMock.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: true,
      expires: "never"
    });
    const { result } = renderHook(() => useCurrentLocation({ autoRequest: false }));
    await waitFor(() => expect(result.current.status).toBe("denied"));
    expect(result.current.coords).toEqual(SAIGON_FALLBACK);
    expect(result.current.isFallback).toBe(true);
    expect(posMock).not.toHaveBeenCalled();
  });
});
