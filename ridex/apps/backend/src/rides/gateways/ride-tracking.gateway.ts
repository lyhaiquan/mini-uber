import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Ack } from "@nestjs/websockets/decorators/ack.decorator";
import type { Namespace, Socket } from "socket.io";

import type { JwtAccessPayload } from "../../auth/auth.types";
import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import {
  DRIVER_LOCATION_UPDATED_EVENT,
  type DriverLocationUpdatedDomainEvent
} from "../../location/events/location-events";
import { ALL_ROLES, Role } from "../../users/dto/role.enum";
import { ACTIVE_RIDE_STATUSES, RideStatus } from "../enums/ride-status.enum";
import {
  RIDE_TRANSITIONED_EVENT,
  type RideTransitionedDomainEvent
} from "../events/ride-events";
import { RidesFacade } from "../rides.facade";
import {
  RIDE_DRIVER_LOCATION_EVENT,
  RIDE_STATUS_CHANGED_EVENT,
  RIDE_SUBSCRIBE_EVENT,
  RIDE_TRACKING_NAMESPACE,
  RIDE_UNSUBSCRIBE_EVENT,
  WS_ERROR_EVENT,
  rideRoomFor,
  rideSubscribeError,
  type RideSubscribeAck,
  type RideSubscribePayload
} from "./ride-tracking-events";

interface TrackingSocketData {
  user?: { id: string; role: Role };
  correlationId?: string;
  subscribedRideIds?: Set<string>;
}

interface TrackingServerToClientEvents {
  [WS_ERROR_EVENT]: (payload: { code: "WS_AUTH_FAILED" | "WS_FORBIDDEN"; message: string }) => void;
  [RIDE_DRIVER_LOCATION_EVENT]: (payload: Record<string, unknown>) => void;
  [RIDE_STATUS_CHANGED_EVENT]: (payload: Record<string, unknown>) => void;
}

type TrackingSocket = Socket<
  Record<string, never>,
  TrackingServerToClientEvents,
  Record<string, never>,
  TrackingSocketData
>;

type SubscribeAckCallback = (response: RideSubscribeAck) => void;
type JwtAccessPayloadWithIssuer = JwtAccessPayload & { iss?: unknown };

const AUTH_FAILED = "WebSocket authentication failed.";
const FORBIDDEN = "Ride tracking is restricted to customers and admins.";
const CONTEXT = "RideTrackingGateway";

// Only roles that legitimately observe rides from the customer side. Drivers
// have their own gateway (LocationGateway) for publishing their position; they
// must not be able to subscribe to other rides through this channel.
const ALLOWED_ROLES: ReadonlyArray<Role> = [Role.CUSTOMER, Role.ADMIN];

// Driver position is only revealed once the ride has been ACCEPTED. While in
// REQUESTED/MATCHING the customer has no assigned driver, and even if a row
// briefly carries a driver_user_id during a race, we never forward it.
const DRIVER_LOCATION_VISIBLE_STATUSES: ReadonlySet<RideStatus> = new Set([
  RideStatus.ACCEPTED,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.IN_PROGRESS
]);

@WebSocketGateway({ namespace: RIDE_TRACKING_NAMESPACE })
export class RideTrackingGateway implements OnGatewayConnection {
  private readonly jwtAccessSecret: string;

  @WebSocketServer()
  private readonly server!: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly ridesFacade: RidesFacade,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.jwtAccessSecret = configService.get("JWT_ACCESS_SECRET", { infer: true });
  }

  async handleConnection(client: TrackingSocket): Promise<void> {
    const token = this.extractToken(client);
    if (token === undefined) {
      this.rejectConnection(client, "WS_AUTH_FAILED", AUTH_FAILED);
      return;
    }

    let payload: JwtAccessPayloadWithIssuer;
    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayloadWithIssuer>(token, {
        secret: this.jwtAccessSecret
      });
    } catch {
      this.rejectConnection(client, "WS_AUTH_FAILED", AUTH_FAILED);
      return;
    }

    if (!this.isValidAccessPayload(payload)) {
      this.rejectConnection(client, "WS_AUTH_FAILED", AUTH_FAILED);
      return;
    }

    if (!ALLOWED_ROLES.includes(payload.role)) {
      this.rejectConnection(client, "WS_FORBIDDEN", FORBIDDEN);
      return;
    }

    client.data.user = { id: payload.sub, role: payload.role };
    client.data.correlationId = randomUUID();
    client.data.subscribedRideIds = new Set();
  }

  @SubscribeMessage(RIDE_SUBSCRIBE_EVENT)
  async handleSubscribe(
    @ConnectedSocket() client: TrackingSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: SubscribeAckCallback
  ): Promise<void> {
    const user = client.data.user;
    if (user === undefined) {
      this.ack(ack, rideSubscribeError("RIDE_FORBIDDEN_ACCESS", FORBIDDEN));
      return;
    }

    const rideId = this.extractRideId(payload);
    if (rideId === undefined) {
      this.ack(ack, rideSubscribeError("INVALID_PAYLOAD", "rideId is required."));
      return;
    }

    try {
      // Reuse the same authorization rules as the REST endpoint to avoid
      // drift: customer can only subscribe to their own ride, admin can see
      // any ride, driver is blocked at connect-time so should never reach here.
      await this.ridesFacade.getRideDetail(rideId, { userId: user.id, role: user.role });
    } catch (error: unknown) {
      const code = this.errorCode(error);
      if (code === "RIDE_NOT_FOUND" || code === "RIDE_FORBIDDEN_ACCESS") {
        this.ack(ack, rideSubscribeError(code, "Cannot subscribe to this ride."));
        return;
      }
      this.logger.warn(
        {
          event: "ride.subscribe.lookup_failed",
          rideId,
          userId: user.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      this.ack(ack, rideSubscribeError("RIDE_NOT_FOUND", "Cannot subscribe to this ride."));
      return;
    }

    await client.join(rideRoomFor(rideId));
    client.data.subscribedRideIds?.add(rideId);
    this.ack(ack, { ok: true });
  }

  @SubscribeMessage(RIDE_UNSUBSCRIBE_EVENT)
  async handleUnsubscribe(
    @ConnectedSocket() client: TrackingSocket,
    @MessageBody() payload: unknown
  ): Promise<void> {
    const rideId = this.extractRideId(payload);
    if (rideId === undefined) {
      return;
    }
    await client.leave(rideRoomFor(rideId));
    client.data.subscribedRideIds?.delete(rideId);
  }

  // --- Outbound fan-out -----------------------------------------------------

  @OnEvent(DRIVER_LOCATION_UPDATED_EVENT)
  async forwardDriverLocation(event: DriverLocationUpdatedDomainEvent): Promise<void> {
    const driverUserId = event.payload.driverId;
    let ride;
    try {
      ride = await this.ridesFacade.findAssignedActiveRideByDriver(driverUserId);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "ride.driver-location.lookup_failed",
          driverUserId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return;
    }

    if (ride === null || !DRIVER_LOCATION_VISIBLE_STATUSES.has(ride.status)) {
      return;
    }

    this.server.to(rideRoomFor(ride.id)).emit(RIDE_DRIVER_LOCATION_EVENT, {
      rideId: ride.id,
      driverUserId,
      lat: event.payload.lat,
      lng: event.payload.lng,
      heading: event.payload.heading ?? null,
      recordedAt: event.payload.recordedAt
    });
  }

  @OnEvent(RIDE_TRANSITIONED_EVENT)
  forwardStatusChanged(event: RideTransitionedDomainEvent): void {
    const { rideId, fromStatus, toStatus, driverUserId, occurredAt } = event.payload;
    this.server.to(rideRoomFor(rideId)).emit(RIDE_STATUS_CHANGED_EVENT, {
      rideId,
      fromStatus,
      toStatus,
      driverUserId,
      occurredAt
    });
  }

  // --- Helpers --------------------------------------------------------------

  private extractToken(client: TrackingSocket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.length > 0) {
      return authToken;
    }
    const headerValue = client.handshake.headers.authorization;
    const authorization = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (typeof authorization !== "string") {
      return undefined;
    }
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    return match?.[1];
  }

  private extractRideId(payload: unknown): string | undefined {
    if (typeof payload !== "object" || payload === null) {
      return undefined;
    }
    const value = (payload as Partial<RideSubscribePayload>).rideId;
    if (typeof value !== "string" || value.length === 0) {
      return undefined;
    }
    // Cheap UUID-shape check — keeps obviously bad input from reaching the
    // facade and lighting up the structured logger with NotFound noise.
    if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
      return undefined;
    }
    return value;
  }

  private rejectConnection(
    client: TrackingSocket,
    code: "WS_AUTH_FAILED" | "WS_FORBIDDEN",
    message: string
  ): void {
    client.emit(WS_ERROR_EVENT, { code, message });
    client.disconnect(true);
  }

  private isValidAccessPayload(
    payload: JwtAccessPayloadWithIssuer
  ): payload is JwtAccessPayload {
    const issuer = payload.iss;
    return (
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      ALL_ROLES.includes(payload.role as Role) &&
      (issuer === undefined || issuer === "ridex")
    );
  }

  private errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }
    const response = (error as { response?: unknown }).response;
    if (typeof response !== "object" || response === null) {
      return undefined;
    }
    const code = (response as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  private ack(ack: SubscribeAckCallback | undefined, response: RideSubscribeAck): void {
    if (typeof ack === "function") {
      ack(response);
    }
  }
}

// Re-export to silence "imported but only used as type" linting from
// downstream consumers that need this set at runtime (e.g. for tests).
export { ACTIVE_RIDE_STATUSES };
