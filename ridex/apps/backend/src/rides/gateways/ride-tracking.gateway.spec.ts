import "reflect-metadata";

import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { Namespace } from "socket.io";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { DriverLocationUpdatedDomainEvent } from "../../location/events/location-events";
import { Role } from "../../users/dto/role.enum";
import { ActorType } from "../enums/actor-type.enum";
import { RideStatus } from "../enums/ride-status.enum";
import type { RideTransitionedDomainEvent } from "../events/ride-events";
import type { RidesFacade } from "../rides.facade";
import {
  RIDE_DRIVER_LOCATION_EVENT,
  RIDE_STATUS_CHANGED_EVENT,
  rideRoomFor
} from "./ride-tracking-events";
import { RideTrackingGateway } from "./ride-tracking.gateway";

const RIDE_ID = "66666666-6666-6666-6666-666666666666";
const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const DRIVER_ID = "33333333-3333-3333-3333-333333333333";

function createGateway(overrides: {
  getRideDetail?: jest.Mock;
  findAssignedActiveRideByDriver?: jest.Mock;
  verifyAsync?: jest.Mock;
} = {}): {
  gateway: RideTrackingGateway;
  emit: jest.Mock;
  to: jest.Mock;
  ridesFacade: {
    getRideDetail: jest.Mock;
    findAssignedActiveRideByDriver: jest.Mock;
  };
} {
  const ridesFacade = {
    getRideDetail: overrides.getRideDetail ?? jest.fn(),
    findAssignedActiveRideByDriver:
      overrides.findAssignedActiveRideByDriver ?? jest.fn()
  };

  const jwtService = {
    verifyAsync: overrides.verifyAsync ?? jest.fn()
  } as unknown as JwtService;

  const configService = {
    get: jest.fn(() => "test-secret")
  } as unknown as ConfigService<EnvironmentVariables, true>;

  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as StructuredLogger;

  const gateway = new RideTrackingGateway(
    jwtService,
    ridesFacade as unknown as RidesFacade,
    logger,
    configService
  );

  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  // @ts-expect-error - inject namespace stub
  gateway["server"] = { to } as unknown as Namespace;

  return { gateway, emit, to, ridesFacade };
}

function makeClient(user?: { id: string; role: Role }): {
  data: { user?: { id: string; role: Role }; subscribedRideIds?: Set<string> };
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  handshake: { auth: { token?: string }; headers: Record<string, string> };
} {
  return {
    data:
      user === undefined
        ? {}
        : { user, subscribedRideIds: new Set() },
    join: jest.fn(async () => undefined),
    leave: jest.fn(async () => undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
    handshake: { auth: {}, headers: {} }
  };
}

describe("RideTrackingGateway.handleConnection", () => {
  it("rejects when no token is presented", async () => {
    const { gateway } = createGateway();
    const client = makeClient();
    // @ts-expect-error stub
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("rejects DRIVER role with WS_FORBIDDEN", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: DRIVER_ID, role: Role.DRIVER });
    const { gateway } = createGateway({ verifyAsync });
    const client = makeClient();
    client.handshake.auth.token = "tok";
    // @ts-expect-error stub
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      "ws:error",
      expect.objectContaining({ code: "WS_FORBIDDEN" })
    );
  });

  it("admits CUSTOMER role and stores user on socket data", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: CUSTOMER_ID, role: Role.CUSTOMER });
    const { gateway } = createGateway({ verifyAsync });
    const client = makeClient();
    client.handshake.auth.token = "tok";
    // @ts-expect-error stub
    await gateway.handleConnection(client);
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data.user).toEqual({ id: CUSTOMER_ID, role: Role.CUSTOMER });
  });
});

describe("RideTrackingGateway.handleSubscribe", () => {
  it("rejects with INVALID_PAYLOAD when rideId is missing", async () => {
    const { gateway } = createGateway();
    const client = makeClient({ id: CUSTOMER_ID, role: Role.CUSTOMER });
    const ack = jest.fn();
    // @ts-expect-error stub
    await gateway.handleSubscribe(client, {}, ack);
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, code: "INVALID_PAYLOAD" })
    );
  });

  it("rejects with RIDE_FORBIDDEN_ACCESS when facade throws forbidden", async () => {
    const getRideDetail = jest.fn().mockRejectedValue({
      response: { code: "RIDE_FORBIDDEN_ACCESS", message: "x" }
    });
    const { gateway } = createGateway({ getRideDetail });
    const client = makeClient({ id: CUSTOMER_ID, role: Role.CUSTOMER });
    const ack = jest.fn();
    // @ts-expect-error stub
    await gateway.handleSubscribe(client, { rideId: RIDE_ID }, ack);
    expect(client.join).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, code: "RIDE_FORBIDDEN_ACCESS" })
    );
  });

  it("joins ride room and acks ok when authorization succeeds", async () => {
    const getRideDetail = jest.fn().mockResolvedValue({ id: RIDE_ID });
    const { gateway } = createGateway({ getRideDetail });
    const client = makeClient({ id: CUSTOMER_ID, role: Role.CUSTOMER });
    const ack = jest.fn();
    // @ts-expect-error stub
    await gateway.handleSubscribe(client, { rideId: RIDE_ID }, ack);
    expect(client.join).toHaveBeenCalledWith(rideRoomFor(RIDE_ID));
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });
});

describe("RideTrackingGateway.forwardDriverLocation", () => {
  function makeLocationEvent(): DriverLocationUpdatedDomainEvent {
    return {
      eventId: "evt-1",
      eventType: "driver.location-updated",
      aggregateType: "driver",
      aggregateId: DRIVER_ID,
      payload: {
        driverId: DRIVER_ID,
        lat: 10.5,
        lng: 106.5,
        heading: 90,
        recordedAt: "2026-05-23T00:00:00.000Z",
        receivedAt: "2026-05-23T00:00:00.500Z"
      },
      correlationId: "corr-1",
      occurredAt: "2026-05-23T00:00:00.000Z",
      emittedBy: "location"
    };
  }

  it("does not emit when driver has no assigned active ride", async () => {
    const findAssignedActiveRideByDriver = jest.fn().mockResolvedValue(null);
    const { gateway, to, emit } = createGateway({ findAssignedActiveRideByDriver });
    await gateway.forwardDriverLocation(makeLocationEvent());
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("emits ride.driver-location to ride room when ride is ACCEPTED+", async () => {
    const findAssignedActiveRideByDriver = jest.fn().mockResolvedValue({
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: DRIVER_ID,
      status: RideStatus.IN_PROGRESS,
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 11, lng: 107 },
      version: 3
    });
    const { gateway, to, emit } = createGateway({ findAssignedActiveRideByDriver });
    await gateway.forwardDriverLocation(makeLocationEvent());
    expect(to).toHaveBeenCalledWith(rideRoomFor(RIDE_ID));
    expect(emit).toHaveBeenCalledWith(
      RIDE_DRIVER_LOCATION_EVENT,
      expect.objectContaining({ rideId: RIDE_ID, driverUserId: DRIVER_ID, lat: 10.5, lng: 106.5 })
    );
  });

  // Defense-in-depth: even if findAssignedActiveRideByDriver returned a row in a
  // non-visible status (shouldn't happen due to its own filter, but cheap to assert).
  it("does not leak driver position for non-visible statuses", async () => {
    const findAssignedActiveRideByDriver = jest.fn().mockResolvedValue({
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: DRIVER_ID,
      status: RideStatus.MATCHING,
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 11, lng: 107 },
      version: 1
    });
    const { gateway, emit } = createGateway({ findAssignedActiveRideByDriver });
    await gateway.forwardDriverLocation(makeLocationEvent());
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("RideTrackingGateway.forwardStatusChanged", () => {
  it("emits ride.status-changed to the ride room", () => {
    const { gateway, to, emit } = createGateway();
    const event: RideTransitionedDomainEvent = {
      eventId: "evt-2",
      eventType: "ride.transitioned",
      aggregateType: "ride",
      aggregateId: RIDE_ID,
      payload: {
        rideId: RIDE_ID,
        customerId: CUSTOMER_ID,
        driverUserId: DRIVER_ID,
        fromStatus: RideStatus.ACCEPTED,
        toStatus: RideStatus.IN_PROGRESS,
        actorType: ActorType.DRIVER,
        occurredAt: "2026-05-23T00:00:00.000Z"
      },
      correlationId: "corr-2",
      occurredAt: "2026-05-23T00:00:00.000Z",
      emittedBy: "rides"
    };

    gateway.forwardStatusChanged(event);

    expect(to).toHaveBeenCalledWith(rideRoomFor(RIDE_ID));
    expect(emit).toHaveBeenCalledWith(
      RIDE_STATUS_CHANGED_EVENT,
      expect.objectContaining({ toStatus: RideStatus.IN_PROGRESS })
    );
  });
});
