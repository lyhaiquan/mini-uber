import { act, renderHook, waitFor } from "@testing-library/react";
import * as Location from "expo-location";

import { useLocationPermission } from "../src/components/map/use-location-permission";

const getMock = Location.getForegroundPermissionsAsync as jest.Mock;
const reqMock = Location.requestForegroundPermissionsAsync as jest.Mock;

beforeEach(() => {
  getMock.mockReset();
  reqMock.mockReset();
});

describe("useLocationPermission", () => {
  it("initialises status from getForegroundPermissionsAsync", async () => {
    getMock.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
      granted: true,
      canAskAgain: true,
      expires: "never"
    });
    const { result } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe("granted");
  });

  it("transitions to denied when request rejects", async () => {
    getMock.mockResolvedValue({
      status: Location.PermissionStatus.UNDETERMINED,
      granted: false,
      canAskAgain: true,
      expires: "never"
    });
    reqMock.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: true,
      expires: "never"
    });
    const { result } = renderHook(() => useLocationPermission());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      const next = await result.current.request();
      expect(next).toBe("denied");
    });
    expect(result.current.status).toBe("denied");
  });
});
