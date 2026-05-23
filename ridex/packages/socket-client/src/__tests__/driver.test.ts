import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

import { io } from "socket.io-client";

import {
  createDriverSocket,
  DRIVER_LOCATION_UPDATE_EVENT,
  emitDriverLocation
} from "../index";

const ioMock = vi.mocked(io);

describe("createDriverSocket", () => {
  beforeEach(() => {
    ioMock.mockReset();
  });

  it("connects to the root url (no namespace) and uses callback auth", () => {
    ioMock.mockReturnValue({ on: vi.fn() } as never);

    createDriverSocket({
      url: "https://api.example.com/",
      getToken: () => "tok-driver"
    });

    expect(ioMock).toHaveBeenCalledTimes(1);
    // The driver socket lives on the default namespace — explicitly NOT /rides.
    expect(ioMock.mock.calls[0]?.[0]).toBe("https://api.example.com");
    const options = ioMock.mock.calls[0]?.[1] as {
      auth: (cb: (payload: { token: string }) => void) => void;
      reconnectionAttempts: number;
    };
    const cb = vi.fn();
    options.auth(cb);
    expect(cb).toHaveBeenCalledWith({ token: "tok-driver" });
    // Spec calls for unlimited reconnect on the driver side — a brief flap
    // must never silently take a driver offline.
    expect(options.reconnectionAttempts).toBe(Infinity);
  });
});

describe("emitDriverLocation", () => {
  it("emits driver.location.update with the payload and resolves the ack", async () => {
    const socket = {
      emit: vi.fn((event: string, _payload: unknown, ack: (a: unknown) => void) => {
        expect(event).toBe(DRIVER_LOCATION_UPDATE_EVENT);
        ack({ ok: true });
      })
    } as never;

    const result = await emitDriverLocation(socket, {
      lat: 10.5,
      lng: 106.5,
      recordedAt: "2026-05-23T00:00:00.000Z"
    });

    expect(result).toEqual({ ok: true });
  });

  it("surfaces the ack code on rejection (GPS_JUMP_DISTANCE)", async () => {
    const socket = {
      emit: vi.fn((_event, _payload, ack: (a: unknown) => void) =>
        ack({ ok: false, code: "GPS_JUMP_DISTANCE", message: "x" })
      )
    } as never;

    const result = await emitDriverLocation(socket, {
      lat: 10.5,
      lng: 106.5,
      recordedAt: "2026-05-23T00:00:00.000Z"
    });

    expect(result).toEqual({
      ok: false,
      code: "GPS_JUMP_DISTANCE",
      message: "x"
    });
  });
});
