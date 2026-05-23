import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { Role } from "../../users/dto/role.enum";
import {
  RIDE_OFFER_ACCEPT_WS_EVENT,
  RIDE_OFFER_ERROR_WS_EVENT,
  RIDE_OFFER_RECEIVED_WS_EVENT,
  RIDE_OFFER_REJECT_WS_EVENT
} from "../matching.constants";
import { OfferNotForDriverError } from "../errors/matching-errors";
import type { OfferOrchestratorService } from "../offer/offer-orchestrator.service";
import { OfferGateway } from "./offer.gateway";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_DRIVER_ID = "44444444-4444-4444-4444-444444444444";
const OFFER_ID = "55555555-5555-5555-8555-555555555555";
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

describe("OfferGateway", () => {
  it("authenticates driver sockets and joins driver room", async () => {
    const { gateway, jwtService } = createGateway();
    const socket = makeSocket();
    jwtService.verifyAsync.mockResolvedValue({ sub: DRIVER_ID, role: Role.DRIVER });

    await gateway.handleConnection(socket as never);

    expect(socket.data.user).toEqual({ id: DRIVER_ID, role: Role.DRIVER });
    expect(socket.join).toHaveBeenCalledWith(`driver:${DRIVER_ID}`);
  });

  it("rejects non-driver sockets", async () => {
    const { gateway, jwtService } = createGateway();
    const socket = makeSocket();
    jwtService.verifyAsync.mockResolvedValue({ sub: "customer-1", role: Role.CUSTOMER });

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith(RIDE_OFFER_ERROR_WS_EVENT, {
      code: "INVALID_PAYLOAD"
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("routes accept using the authenticated driver id and ignores spoofed payload driver ids", async () => {
    const { gateway, orchestrator } = createGateway();
    const socket = makeDriverSocket();
    const ack = jest.fn();

    await gateway.handleAccept(
      socket as never,
      { offerId: OFFER_ID, driverId: OTHER_DRIVER_ID },
      ack
    );

    expect(orchestrator.handleAccept).toHaveBeenCalledWith(OFFER_ID, DRIVER_ID);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it("routes reject with an optional reason", async () => {
    const { gateway, orchestrator } = createGateway();
    const socket = makeDriverSocket();

    await gateway.handleReject(socket as never, { offerId: OFFER_ID, reason: "busy" });

    expect(orchestrator.handleReject).toHaveBeenCalledWith(OFFER_ID, DRIVER_ID, "busy");
  });

  it("emits private errors when a driver acts on another driver's offer", async () => {
    const { gateway, orchestrator } = createGateway();
    const socket = makeDriverSocket();
    orchestrator.handleAccept.mockRejectedValue(new OfferNotForDriverError(OFFER_ID));

    await gateway.handleAccept(socket as never, { offerId: OFFER_ID });

    expect(socket.emit).toHaveBeenCalledWith(RIDE_OFFER_ERROR_WS_EVENT, {
      code: "NOT_FOR_DRIVER",
      offerId: OFFER_ID
    });
  });

  it("emits offer received payloads to the addressed driver's room", () => {
    const { gateway, server } = createGateway();

    gateway.emitOfferReceived(DRIVER_ID, {
      offerId: OFFER_ID,
      rideId: "ride-1",
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 11, lng: 107 },
      distanceMeters: 1000,
      durationSeconds: 60,
      expiresAt: "2026-05-17T00:00:00.000Z",
      routeConfidence: "high"
    });

    expect(server.to).toHaveBeenCalledWith(`driver:${DRIVER_ID}`);
    expect(server.emit).toHaveBeenCalledWith(
      RIDE_OFFER_RECEIVED_WS_EVENT,
      expect.objectContaining({ offerId: OFFER_ID })
    );
  });
});

function createGateway(): {
  gateway: OfferGateway;
  jwtService: jest.Mocked<JwtService>;
  orchestrator: jest.Mocked<OfferOrchestratorService>;
  server: { to: jest.Mock; emit: jest.Mock };
} {
  const jwtService = {
    verifyAsync: jest.fn()
  } as unknown as jest.Mocked<JwtService>;
  const orchestrator = {
    handleAccept: jest.fn(),
    handleReject: jest.fn()
  } as unknown as jest.Mocked<OfferOrchestratorService>;
  const logger = {
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      const values: Partial<EnvironmentVariables> = {
        JWT_ACCESS_SECRET: JWT_SECRET
      };
      return values[key];
    })
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const gateway = new OfferGateway(jwtService, orchestrator, logger, configService);
  const server = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  };
  gateway.server = server as never;

  return { gateway, jwtService, orchestrator, server };
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
