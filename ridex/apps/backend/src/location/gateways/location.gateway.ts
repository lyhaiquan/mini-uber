import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import { Ack } from "@nestjs/websockets/decorators/ack.decorator";
import { ValidationPipe, type ArgumentMetadata } from "@nestjs/common";
import type { Socket } from "socket.io";

import type { JwtAccessPayload } from "../../auth/auth.types";
import type { DomainEvent } from "../../common/domain-event";
import { StructuredLogger } from "../../common/logging/structured-logger";
import { createGlobalValidationPipe } from "../../common/pipes/validation-pipe.factory";
import type { EnvironmentVariables } from "../../config/env.validation";
import { DriversFacade } from "../../drivers/drivers.facade";
import { ALL_ROLES, Role } from "../../users/dto/role.enum";
import type { CachedLocation } from "../cache/cached-location.types";
import { DriverLocationCacheService } from "../cache/driver-location-cache.service";
import { DriverLocationDto } from "../dto/driver-location.dto";
import {
  locationAckError,
  type LocationAck,
  type LocationErrorCode
} from "../dto/driver-location-ack.dto";
import {
  DRIVER_LOCATION_UPDATED_EVENT,
  DRIVER_LOCATION_UPDATE_WS_EVENT,
  WS_ERROR_EVENT,
  type DriverLocationUpdatedPayload
} from "../events/location-events";
import { GpsJumpDetectionService } from "../jump/gps-jump-detection.service";

interface DriverSocketData {
  user?: {
    id: string;
    role: Role;
  };
  correlationId?: string;
}

interface ServerToClientEvents {
  [WS_ERROR_EVENT]: (payload: { code: "WS_AUTH_FAILED" | "WS_FORBIDDEN"; message: string }) => void;
}

type DriverSocket = Socket<Record<string, never>, ServerToClientEvents, Record<string, never>, DriverSocketData>;

type AckCallback = (response: LocationAck) => void;
type JwtAccessPayloadWithIssuer = JwtAccessPayload & { iss?: unknown };

const AUTH_FAILED_MESSAGE = "WebSocket authentication failed.";
const FORBIDDEN_MESSAGE = "WebSocket connection requires the DRIVER role.";
const FUTURE_CLOCK_SKEW_MS = 5_000;
const CONTEXT = "LocationGateway";

@WebSocketGateway()
export class LocationGateway implements OnGatewayConnection {
  private readonly jwtAccessSecret: string;
  private readonly maxSpeedMps: number;
  private readonly driverLocationTtlMs: number;
  private readonly validationPipe: ValidationPipe;
  private readonly validationMetadata: ArgumentMetadata = {
    type: "body",
    metatype: DriverLocationDto,
    data: undefined
  };

  constructor(
    private readonly jwtService: JwtService,
    private readonly driversFacade: DriversFacade,
    private readonly cacheService: DriverLocationCacheService,
    private readonly jumpDetectionService: GpsJumpDetectionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.jwtAccessSecret = configService.get("JWT_ACCESS_SECRET", { infer: true });
    this.maxSpeedMps = configService.get("LOCATION_MAX_SPEED_MPS", { infer: true });
    this.driverLocationTtlMs =
      configService.get("DRIVER_LOCATION_TTL_SECONDS", { infer: true }) * 1000;
    this.validationPipe = createGlobalValidationPipe();
  }

  async handleConnection(client: DriverSocket): Promise<void> {
    const token = this.extractToken(client);

    if (token === undefined) {
      this.rejectConnection(client, "WS_AUTH_FAILED", AUTH_FAILED_MESSAGE);
      return;
    }

    let payload: JwtAccessPayloadWithIssuer;

    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayloadWithIssuer>(token, {
        secret: this.jwtAccessSecret
      });
    } catch {
      this.rejectConnection(client, "WS_AUTH_FAILED", AUTH_FAILED_MESSAGE);
      return;
    }

    if (!this.isValidAccessPayload(payload)) {
      this.rejectConnection(client, "WS_AUTH_FAILED", AUTH_FAILED_MESSAGE);
      return;
    }

    if (payload.role !== Role.DRIVER) {
      this.rejectConnection(client, "WS_FORBIDDEN", FORBIDDEN_MESSAGE);
      return;
    }

    client.data.user = {
      id: payload.sub,
      role: payload.role
    };
    client.data.correlationId = randomUUID();
    await client.join(`driver:${payload.sub}`);
  }

  @SubscribeMessage(DRIVER_LOCATION_UPDATE_WS_EVENT)
  async handleDriverLocationUpdate(
    @ConnectedSocket() client: DriverSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: AckCallback
  ): Promise<void> {
    const user = client.data.user;

    if (user === undefined || user.role !== Role.DRIVER) {
      this.ack(ack, locationAckError("DRIVER_OFFLINE", "Driver is not online."));
      return;
    }

    const validationResult = await this.validateLocationPayload(payload);

    if (validationResult.ok === false) {
      this.ack(ack, locationAckError("INVALID_PAYLOAD", validationResult.message));
      return;
    }

    const dto = validationResult.dto;
    const recordedAt = new Date(dto.recordedAt);
    const dateError = this.validateRecordedAt(recordedAt, new Date());

    if (dateError !== undefined) {
      this.ack(ack, locationAckError("INVALID_PAYLOAD", dateError));
      return;
    }

    if (dto.speed !== undefined && dto.speed > this.maxSpeedMps) {
      this.ack(ack, locationAckError("INVALID_PAYLOAD", "speed exceeds configured maximum."));
      return;
    }

    const driverId = user.id;

    try {
      const isOnline = await this.driversFacade.isOnline(driverId);

      if (!isOnline) {
        this.ack(ack, locationAckError("DRIVER_OFFLINE", "Driver is not online."));
        return;
      }

      const previousLocation = await this.cacheService.get(driverId);
      const jumpDecision = this.jumpDetectionService.evaluate(previousLocation, {
        lat: dto.lat,
        lng: dto.lng,
        recordedAt
      });

      if (!jumpDecision.allowed) {
        this.ack(ack, locationAckError(jumpDecision.code, this.errorMessage(jumpDecision.code)));
        return;
      }

      const receivedAt = new Date().toISOString();
      const cachedLocation: CachedLocation = {
        lat: dto.lat,
        lng: dto.lng,
        recordedAt: recordedAt.toISOString(),
        receivedAt
      };

      if (dto.heading !== undefined) {
        cachedLocation.heading = dto.heading;
      }
      if (dto.speed !== undefined) {
        cachedLocation.speed = dto.speed;
      }
      if (dto.accuracy !== undefined) {
        cachedLocation.accuracy = dto.accuracy;
      }

      await this.cacheService.set(driverId, cachedLocation);
      this.eventEmitter.emit(
        DRIVER_LOCATION_UPDATED_EVENT,
        this.createLocationUpdatedEvent(driverId, cachedLocation, client)
      );
      this.ack(ack, { ok: true });
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "driver.location.update.failed",
          driverId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
      this.ack(ack, locationAckError("INTERNAL", "Location update failed."));
    }
  }

  private extractToken(client: DriverSocket): string | undefined {
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

  private rejectConnection(client: DriverSocket, code: "WS_AUTH_FAILED" | "WS_FORBIDDEN", message: string): void {
    client.emit(WS_ERROR_EVENT, { code, message });
    client.disconnect(true);
  }

  private isValidAccessPayload(payload: JwtAccessPayloadWithIssuer): payload is JwtAccessPayload {
    const issuer = payload.iss;

    return (
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      ALL_ROLES.includes(payload.role as Role) &&
      (issuer === undefined || issuer === "ridex")
    );
  }

  private async validateLocationPayload(
    payload: unknown
  ): Promise<{ ok: true; dto: DriverLocationDto } | { ok: false; message: string }> {
    try {
      const transformed = await this.validationPipe.transform(
        this.stripSpoofedDriverId(payload),
        this.validationMetadata
      );
      return { ok: true, dto: transformed as DriverLocationDto };
    } catch {
      return { ok: false, message: "Location payload is invalid." };
    }
  }

  private stripSpoofedDriverId(payload: unknown): unknown {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return {};
    }

    const sanitized = { ...(payload as Record<string, unknown>) };
    delete sanitized.driverId;
    return sanitized;
  }

  private validateRecordedAt(recordedAt: Date, now: Date): string | undefined {
    const timestamp = recordedAt.getTime();

    if (Number.isNaN(timestamp)) {
      return "recordedAt must be a valid ISO-8601 timestamp.";
    }

    if (timestamp > now.getTime() + FUTURE_CLOCK_SKEW_MS) {
      return "recordedAt is too far in the future.";
    }

    if (now.getTime() - timestamp > this.driverLocationTtlMs) {
      return "recordedAt is too old.";
    }

    return undefined;
  }

  private createLocationUpdatedEvent(
    driverId: string,
    location: CachedLocation,
    client: DriverSocket
  ): DomainEvent<DriverLocationUpdatedPayload> {
    return {
      eventId: randomUUID(),
      eventType: DRIVER_LOCATION_UPDATED_EVENT,
      aggregateType: "driver",
      aggregateId: driverId,
      payload: {
        driverId,
        lat: location.lat,
        lng: location.lng,
        heading: location.heading,
        speed: location.speed,
        recordedAt: location.recordedAt,
        receivedAt: location.receivedAt
      },
      correlationId: client.data.correlationId ?? randomUUID(),
      occurredAt: new Date().toISOString(),
      emittedBy: "location"
    };
  }

  private errorMessage(code: LocationErrorCode): string {
    switch (code) {
      case "STALE_TIMESTAMP":
        return "Location timestamp is stale.";
      case "GPS_JUMP_DISTANCE":
        return "Location jump distance is too large.";
      case "GPS_JUMP_SPEED":
        return "Location jump speed is too high.";
      case "INVALID_PAYLOAD":
      case "DRIVER_OFFLINE":
      case "INTERNAL":
        return "Location update failed.";
      default:
        return exhaustive(code);
    }
  }

  private ack(ack: AckCallback | undefined, response: LocationAck): void {
    if (typeof ack === "function") {
      ack(response);
    }
  }
}

function exhaustive(value: never): never {
  throw new Error(`Unhandled location error code: ${value}`);
}
