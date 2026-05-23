import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { JwtService } from "@nestjs/jwt";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { DriversFacade } from "../../drivers/drivers.facade";
import { Role } from "../../users/dto/role.enum";
import type { CachedLocation } from "../cache/cached-location.types";
import type { DriverLocationCacheService } from "../cache/driver-location-cache.service";
import type { LocationAck } from "../dto/driver-location-ack.dto";
import { DRIVER_LOCATION_UPDATED_EVENT, WS_ERROR_EVENT } from "../events/location-events";
import type { GpsJumpDetectionService } from "../jump/gps-jump-detection.service";
import { LocationGateway } from "./location.gateway";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const SPOOFED_DRIVER_ID = "99999999-9999-9999-9999-999999999999";
const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const JWT_SECRET = "access-secret-32-chars-min-length-aaa";

interface MockSocket {
  handshake: {
    auth: Record<string, unknown>;
    headers: {
      authorization?: string;
    };
  };
  data: {
    user?: {
      id: string;
      role: Role;
    };
    correlationId?: string;
  };
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
}

function createGateway(): {
  gateway: LocationGateway;
  jwtService: jest.Mocked<JwtService>;
  driversFacade: jest.Mocked<DriversFacade>;
  cacheService: jest.Mocked<DriverLocationCacheService>;
  jumpDetectionService: jest.Mocked<GpsJumpDetectionService>;
  eventEmitter: jest.Mocked<EventEmitter2>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const jwtService = {
    verifyAsync: jest.fn()
  } as unknown as jest.Mocked<JwtService>;
  const driversFacade = {
    isOnline: jest.fn().mockResolvedValue(true)
  } as unknown as jest.Mocked<DriversFacade>;
  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn()
  } as unknown as jest.Mocked<DriverLocationCacheService>;
  const jumpDetectionService = {
    evaluate: jest.fn().mockReturnValue({ allowed: true })
  } as unknown as jest.Mocked<GpsJumpDetectionService>;
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;
  const logger = {
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      const values: Partial<EnvironmentVariables> = {
        JWT_ACCESS_SECRET: JWT_SECRET,
        LOCATION_MAX_SPEED_MPS: 55,
        DRIVER_LOCATION_TTL_SECONDS: 60
      };
      return values[key];
    })
  } as unknown as ConfigService<EnvironmentVariables, true>;

  const gateway = new LocationGateway(
    jwtService,
    driversFacade,
    cacheService,
    jumpDetectionService,
    eventEmitter,
    logger,
    configService
  );

  return {
    gateway,
    jwtService,
    driversFacade,
    cacheService,
    jumpDetectionService,
    eventEmitter,
    logger
  };
}

function makeSocket(overrides: Partial<MockSocket> = {}): MockSocket {
  return {
    handshake: {
      auth: { token: "access-token" },
      headers: {}
    },
    data: {},
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    ...overrides
  };
}

function makeDriverSocket(): MockSocket {
  return makeSocket({
    data: {
      user: { id: DRIVER_ID, role: Role.DRIVER },
      correlationId: "socket-correlation"
    }
  });
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lat: 10.7769,
    lng: 106.7009,
    heading: 120,
    speed: 10,
    accuracy: 5,
    recordedAt: new Date().toISOString(),
    ...overrides
  };
}

function ack(): jest.Mock<void, [LocationAck]> {
  return jest.fn<void, [LocationAck]>();
}

describe("LocationGateway.handleConnection", () => {
  it("accepts valid DRIVER JWTs and joins the driver room", async () => {
    const { gateway, jwtService } = createGateway();
    const socket = makeSocket();
    jwtService.verifyAsync.mockResolvedValue({ sub: DRIVER_ID, role: Role.DRIVER });

    await gateway.handleConnection(socket as never);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith("access-token", {
      secret: JWT_SECRET
    });
    expect(socket.data.user).toEqual({ id: DRIVER_ID, role: Role.DRIVER });
    expect(socket.data.correlationId).toEqual(expect.any(String));
    expect(socket.join).toHaveBeenCalledWith(`driver:${DRIVER_ID}`);
  });

  it("accepts Authorization bearer token when auth token is missing", async () => {
    const { gateway, jwtService } = createGateway();
    const socket = makeSocket({
      handshake: {
        auth: {},
        headers: { authorization: "Bearer header-token" }
      }
    });
    jwtService.verifyAsync.mockResolvedValue({ sub: DRIVER_ID, role: Role.DRIVER });

    await gateway.handleConnection(socket as never);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith("header-token", expect.any(Object));
  });

  it("rejects missing, expired, malformed, and wrong-issuer tokens", async () => {
    const { gateway, jwtService } = createGateway();
    const missing = makeSocket({ handshake: { auth: {}, headers: {} } });

    await gateway.handleConnection(missing as never);

    expect(missing.emit).toHaveBeenCalledWith(WS_ERROR_EVENT, {
      code: "WS_AUTH_FAILED",
      message: expect.any(String)
    });
    expect(missing.disconnect).toHaveBeenCalledWith(true);

    const malformed = makeSocket();
    jwtService.verifyAsync.mockRejectedValueOnce(new Error("bad token"));
    await gateway.handleConnection(malformed as never);
    expect(malformed.emit).toHaveBeenCalledWith(WS_ERROR_EVENT, {
      code: "WS_AUTH_FAILED",
      message: expect.any(String)
    });

    const wrongIssuer = makeSocket();
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: DRIVER_ID,
      role: Role.DRIVER,
      iss: "other"
    });
    await gateway.handleConnection(wrongIssuer as never);
    expect(wrongIssuer.emit).toHaveBeenCalledWith(WS_ERROR_EVENT, {
      code: "WS_AUTH_FAILED",
      message: expect.any(String)
    });
  });

  it("rejects CUSTOMER role with WS_FORBIDDEN", async () => {
    const { gateway, jwtService } = createGateway();
    const socket = makeSocket();
    jwtService.verifyAsync.mockResolvedValue({ sub: CUSTOMER_ID, role: Role.CUSTOMER });

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith(WS_ERROR_EVENT, {
      code: "WS_FORBIDDEN",
      message: expect.any(String)
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});

describe("LocationGateway.handleDriverLocationUpdate", () => {
  it("accepts valid updates, stores cache, acks ok, and emits domain event", async () => {
    const { gateway, cacheService, eventEmitter } = createGateway();
    const socket = makeDriverSocket();
    const callback = ack();

    await gateway.handleDriverLocationUpdate(socket as never, validPayload(), callback);

    expect(cacheService.set).toHaveBeenCalledWith(
      DRIVER_ID,
      expect.objectContaining({
        lat: 10.7769,
        lng: 106.7009,
        heading: 120,
        speed: 10,
        accuracy: 5
      })
    );
    expect(callback).toHaveBeenCalledWith({ ok: true });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DRIVER_LOCATION_UPDATED_EVENT,
      expect.objectContaining({
        eventType: DRIVER_LOCATION_UPDATED_EVENT,
        aggregateId: DRIVER_ID,
        correlationId: "socket-correlation",
        emittedBy: "location",
        payload: expect.objectContaining({ driverId: DRIVER_ID })
      })
    );
  });

  it("acks DRIVER_OFFLINE when the driver is not online", async () => {
    const { gateway, driversFacade } = createGateway();
    driversFacade.isOnline.mockResolvedValue(false);
    const callback = ack();

    await gateway.handleDriverLocationUpdate(makeDriverSocket() as never, validPayload(), callback);

    expect(callback).toHaveBeenCalledWith({
      ok: false,
      error: { code: "DRIVER_OFFLINE", message: expect.any(String) }
    });
  });

  it("acks INVALID_PAYLOAD for bad coordinates and recordedAt values", async () => {
    const { gateway, driversFacade } = createGateway();
    const callback = ack();

    await gateway.handleDriverLocationUpdate(
      makeDriverSocket() as never,
      validPayload({ lat: 91 }),
      callback
    );

    expect(callback).toHaveBeenCalledWith({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: expect.any(String) }
    });
    expect(driversFacade.isOnline).not.toHaveBeenCalled();

    const future = ack();
    await gateway.handleDriverLocationUpdate(
      makeDriverSocket() as never,
      validPayload({ recordedAt: new Date(Date.now() + 10_000).toISOString() }),
      future
    );
    expect(future).toHaveBeenCalledWith({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: expect.any(String) }
    });

    const tooOld = ack();
    await gateway.handleDriverLocationUpdate(
      makeDriverSocket() as never,
      validPayload({ recordedAt: new Date(Date.now() - 61_000).toISOString() }),
      tooOld
    );
    expect(tooOld).toHaveBeenCalledWith({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: expect.any(String) }
    });
  });

  it("maps jump detector rejections to stale, distance, and speed ack codes", async () => {
    const { gateway, jumpDetectionService } = createGateway();

    for (const code of ["STALE_TIMESTAMP", "GPS_JUMP_DISTANCE", "GPS_JUMP_SPEED"] as const) {
      jumpDetectionService.evaluate.mockReturnValueOnce({ allowed: false, code });
      const callback = ack();

      await gateway.handleDriverLocationUpdate(makeDriverSocket() as never, validPayload(), callback);

      expect(callback).toHaveBeenCalledWith({
        ok: false,
        error: { code, message: expect.any(String) }
      });
    }
  });

  it("ignores spoofed driverId and uses the authenticated socket identity", async () => {
    const { gateway, cacheService } = createGateway();
    const callback = ack();

    await gateway.handleDriverLocationUpdate(
      makeDriverSocket() as never,
      validPayload({ driverId: SPOOFED_DRIVER_ID }),
      callback
    );

    expect(cacheService.set).toHaveBeenCalledWith(DRIVER_ID, expect.any(Object));
    expect(cacheService.set).not.toHaveBeenCalledWith(SPOOFED_DRIVER_ID, expect.any(Object));
    expect(callback).toHaveBeenCalledWith({ ok: true });
  });

  it("acks INTERNAL and logs safe context when Redis throws", async () => {
    const { gateway, cacheService, logger } = createGateway();
    cacheService.set.mockRejectedValue(new Error("redis down"));
    const callback = ack();

    await gateway.handleDriverLocationUpdate(makeDriverSocket() as never, validPayload(), callback);

    expect(callback).toHaveBeenCalledWith({
      ok: false,
      error: { code: "INTERNAL", message: expect.any(String) }
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "driver.location.update.failed", driverId: DRIVER_ID }),
      expect.any(String),
      "LocationGateway"
    );
  });

  it("does not throw when the client omits the ack callback", async () => {
    const { gateway, cacheService } = createGateway();

    await expect(
      gateway.handleDriverLocationUpdate(makeDriverSocket() as never, validPayload())
    ).resolves.toBeUndefined();
    expect(cacheService.set).toHaveBeenCalledWith(DRIVER_ID, expect.any(Object));
  });

  it("passes previous cached location into jump detection", async () => {
    const { gateway, cacheService, jumpDetectionService } = createGateway();
    const previous: CachedLocation = {
      lat: 10,
      lng: 106,
      recordedAt: new Date(Date.now() - 1_000).toISOString(),
      receivedAt: new Date(Date.now() - 1_000).toISOString()
    };
    cacheService.get.mockResolvedValue(previous);

    await gateway.handleDriverLocationUpdate(makeDriverSocket() as never, validPayload(), ack());

    expect(jumpDetectionService.evaluate).toHaveBeenCalledWith(
      previous,
      expect.objectContaining({ lat: 10.7769, lng: 106.7009, recordedAt: expect.any(Date) })
    );
  });
});
