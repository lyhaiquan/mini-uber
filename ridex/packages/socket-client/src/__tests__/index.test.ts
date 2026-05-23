import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

import { io } from "socket.io-client";

import {
  createTrackingSocket,
  RIDE_DRIVER_LOCATION_EVENT,
  RIDE_STATUS_CHANGED_EVENT,
  RIDE_SUBSCRIBE_EVENT,
  RIDE_TRACKING_NAMESPACE,
  RIDE_UNSUBSCRIBE_EVENT,
  WS_ERROR_EVENT
} from "../index";

const ioMock = vi.mocked(io);

describe("socket-client wire constants", () => {
  it("matches backend RideTrackingGateway namespace and event names", () => {
    expect(RIDE_TRACKING_NAMESPACE).toBe("/rides");
    expect(RIDE_SUBSCRIBE_EVENT).toBe("ride.subscribe");
    expect(RIDE_UNSUBSCRIBE_EVENT).toBe("ride.unsubscribe");
    expect(RIDE_DRIVER_LOCATION_EVENT).toBe("ride.driver-location");
    expect(RIDE_STATUS_CHANGED_EVENT).toBe("ride.status-changed");
    expect(WS_ERROR_EVENT).toBe("ws:error");
  });
});

describe("createTrackingSocket", () => {
  beforeEach(() => {
    ioMock.mockReset();
  });

  it("connects to <url>/rides and uses callback auth so reconnects pick up fresh tokens", () => {
    ioMock.mockReturnValue({ on: vi.fn() } as never);

    const getToken = vi.fn(() => "tok-1");
    createTrackingSocket({ url: "https://api.example.com/", getToken });

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock.mock.calls[0]?.[0]).toBe("https://api.example.com/rides");
    const options = ioMock.mock.calls[0]?.[1] as {
      auth: (cb: (payload: { token: string }) => void) => void;
      reconnection: boolean;
      transports: string[];
    };
    expect(options.reconnection).toBe(true);
    expect(options.transports).toEqual(["websocket"]);

    const cb = vi.fn();
    options.auth(cb);
    expect(cb).toHaveBeenCalledWith({ token: "tok-1" });
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("invokes onAuthError when server emits ws:error with WS_AUTH_FAILED", () => {
    let registered: ((payload: { code: string; message: string }) => void) | null = null;
    ioMock.mockReturnValue({
      on: (event: string, handler: (payload: { code: string; message: string }) => void) => {
        if (event === WS_ERROR_EVENT) {
          registered = handler;
        }
      }
    } as never);

    const onAuthError = vi.fn();
    createTrackingSocket({
      url: "https://api.example.com",
      getToken: () => "tok",
      onAuthError
    });

    expect(registered).not.toBeNull();
    registered!({ code: "WS_AUTH_FAILED", message: "x" });
    expect(onAuthError).toHaveBeenCalledWith({ code: "WS_AUTH_FAILED", message: "x" });
  });
});
