import { randomUUID } from "node:crypto";

import { forwardRef, Inject, ValidationPipe, type ArgumentMetadata } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
import type { Server, Socket } from "socket.io";

import type { JwtAccessPayload } from "../../auth/auth.types";
import { StructuredLogger } from "../../common/logging/structured-logger";
import { createGlobalValidationPipe } from "../../common/pipes/validation-pipe.factory";
import type { EnvironmentVariables } from "../../config/env.validation";
import { ALL_ROLES, Role } from "../../users/dto/role.enum";
import {
  DRIVER_OFFER_ROOM_PREFIX,
  RIDE_OFFER_ACCEPT_WS_EVENT,
  RIDE_OFFER_CANCELLED_WS_EVENT,
  RIDE_OFFER_ERROR_WS_EVENT,
  RIDE_OFFER_RECEIVED_WS_EVENT,
  RIDE_OFFER_REJECT_WS_EVENT
} from "../matching.constants";
import type {
  OfferCancelledPayload,
  OfferErrorPayload,
  OfferReceivedPayload
} from "../matching.types";
import { OfferNotForDriverError, OfferNotFoundError, OfferNotOfferableError } from "../errors/matching-errors";
import { OfferOrchestratorService } from "../offer/offer-orchestrator.service";
import { OfferActionDto } from "./offer-action.dto";

interface DriverSocketData {
  user?: {
    id: string;
    role: Role;
  };
  correlationId?: string;
}

interface ServerToClientEvents {
  [RIDE_OFFER_RECEIVED_WS_EVENT]: (payload: OfferReceivedPayload) => void;
  [RIDE_OFFER_CANCELLED_WS_EVENT]: (payload: OfferCancelledPayload) => void;
  [RIDE_OFFER_ERROR_WS_EVENT]: (payload: OfferErrorPayload) => void;
}

type DriverSocket = Socket<Record<string, never>, ServerToClientEvents, Record<string, never>, DriverSocketData>;
type OfferAck = { ok: true } | { ok: false; error: OfferErrorPayload };
type AckCallback = (response: OfferAck) => void;
type JwtAccessPayloadWithIssuer = JwtAccessPayload & { iss?: unknown };

const AUTH_FAILED_MESSAGE = "WebSocket authentication failed.";
const FORBIDDEN_MESSAGE = "WebSocket connection requires the DRIVER role.";

@WebSocketGateway()
export class OfferGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server<Record<string, never>, ServerToClientEvents>;

  private readonly jwtAccessSecret: string;
  private readonly validationPipe: ValidationPipe;
  private readonly validationMetadata: ArgumentMetadata = {
    type: "body",
    metatype: OfferActionDto,
    data: undefined
  };

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => OfferOrchestratorService))
    private readonly orchestrator: OfferOrchestratorService,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.jwtAccessSecret = configService.get("JWT_ACCESS_SECRET", { infer: true });
    this.validationPipe = createGlobalValidationPipe();
  }

  async handleConnection(client: DriverSocket): Promise<void> {
    const token = this.extractToken(client);

    if (token === undefined) {
      this.rejectConnection(client, "INVALID_PAYLOAD", AUTH_FAILED_MESSAGE);
      return;
    }

    let payload: JwtAccessPayloadWithIssuer;
    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayloadWithIssuer>(token, {
        secret: this.jwtAccessSecret
      });
    } catch {
      this.rejectConnection(client, "INVALID_PAYLOAD", AUTH_FAILED_MESSAGE);
      return;
    }

    if (!this.isValidAccessPayload(payload)) {
      this.rejectConnection(client, "INVALID_PAYLOAD", AUTH_FAILED_MESSAGE);
      return;
    }

    if (payload.role !== Role.DRIVER) {
      this.rejectConnection(client, "INVALID_PAYLOAD", FORBIDDEN_MESSAGE);
      return;
    }

    client.data.user = { id: payload.sub, role: payload.role };
    client.data.correlationId = randomUUID();
    await client.join(this.driverRoom(payload.sub));
  }

  emitOfferReceived(driverUserId: string, payload: OfferReceivedPayload): void {
    this.server.to(this.driverRoom(driverUserId)).emit(RIDE_OFFER_RECEIVED_WS_EVENT, payload);
  }

  emitOfferCancelled(driverUserId: string, payload: OfferCancelledPayload): void {
    this.server.to(this.driverRoom(driverUserId)).emit(RIDE_OFFER_CANCELLED_WS_EVENT, payload);
  }

  @SubscribeMessage(RIDE_OFFER_ACCEPT_WS_EVENT)
  async handleAccept(
    @ConnectedSocket() client: DriverSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: AckCallback
  ): Promise<void> {
    const dto = await this.validatePayload(payload);
    if (dto === null) {
      this.fail(client, ack, { code: "INVALID_PAYLOAD" });
      return;
    }

    const driverUserId = this.authenticatedDriverId(client);
    if (driverUserId === null) {
      this.fail(client, ack, { code: "INVALID_PAYLOAD", offerId: dto.offerId });
      return;
    }

    try {
      await this.orchestrator.handleAccept(dto.offerId, driverUserId);
      this.ack(ack, { ok: true });
    } catch (error: unknown) {
      this.handleActionError(client, ack, dto.offerId, error);
    }
  }

  @SubscribeMessage(RIDE_OFFER_REJECT_WS_EVENT)
  async handleReject(
    @ConnectedSocket() client: DriverSocket,
    @MessageBody() payload: unknown,
    @Ack() ack?: AckCallback
  ): Promise<void> {
    const dto = await this.validatePayload(payload);
    if (dto === null) {
      this.fail(client, ack, { code: "INVALID_PAYLOAD" });
      return;
    }

    const driverUserId = this.authenticatedDriverId(client);
    if (driverUserId === null) {
      this.fail(client, ack, { code: "INVALID_PAYLOAD", offerId: dto.offerId });
      return;
    }

    try {
      await this.orchestrator.handleReject(dto.offerId, driverUserId, dto.reason);
      this.ack(ack, { ok: true });
    } catch (error: unknown) {
      this.handleActionError(client, ack, dto.offerId, error);
    }
  }

  private async validatePayload(payload: unknown): Promise<OfferActionDto | null> {
    try {
      return (await this.validationPipe.transform(
        this.stripSpoofedDriverId(payload),
        this.validationMetadata
      )) as OfferActionDto;
    } catch {
      return null;
    }
  }

  private stripSpoofedDriverId(payload: unknown): unknown {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return {};
    }
    const sanitized = { ...(payload as Record<string, unknown>) };
    delete sanitized.driverId;
    delete sanitized.driverUserId;
    return sanitized;
  }

  private authenticatedDriverId(client: DriverSocket): string | null {
    const user = client.data.user;
    if (user === undefined || user.role !== Role.DRIVER) {
      return null;
    }
    return user.id;
  }

  private handleActionError(
    client: DriverSocket,
    ack: AckCallback | undefined,
    offerId: string,
    error: unknown
  ): void {
    if (error instanceof OfferNotForDriverError) {
      this.fail(client, ack, { code: "NOT_FOR_DRIVER", offerId });
      return;
    }
    if (error instanceof OfferNotOfferableError) {
      this.fail(client, ack, { code: "ALREADY_FINALIZED", offerId });
      return;
    }
    if (error instanceof OfferNotFoundError) {
      this.fail(client, ack, { code: "OFFER_NOT_FOUND", offerId });
      return;
    }

    this.logger.error(
      {
        event: "matching.offer.action.failed",
        offerId,
        errorName: error instanceof Error ? error.name : "UnknownError"
      },
      error instanceof Error ? error.stack : undefined,
      "OfferGateway"
    );
    this.fail(client, ack, { code: "ALREADY_FINALIZED", offerId });
  }

  private fail(
    client: DriverSocket,
    ack: AckCallback | undefined,
    payload: OfferErrorPayload
  ): void {
    client.emit(RIDE_OFFER_ERROR_WS_EVENT, payload);
    this.ack(ack, { ok: false, error: payload });
  }

  private ack(ack: AckCallback | undefined, response: OfferAck): void {
    if (typeof ack === "function") {
      ack(response);
    }
  }

  private rejectConnection(
    client: DriverSocket,
    code: OfferErrorPayload["code"],
    message: string
  ): void {
    client.emit(RIDE_OFFER_ERROR_WS_EVENT, { code });
    this.logger.warn({ event: "matching.offer.ws_rejected", message }, "OfferGateway");
    client.disconnect(true);
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

  private isValidAccessPayload(payload: JwtAccessPayloadWithIssuer): payload is JwtAccessPayload {
    const issuer = payload.iss;
    return (
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      ALL_ROLES.includes(payload.role as Role) &&
      (issuer === undefined || issuer === "ridex")
    );
  }

  private driverRoom(driverUserId: string): string {
    return `${DRIVER_OFFER_ROOM_PREFIX}${driverUserId}`;
  }
}
