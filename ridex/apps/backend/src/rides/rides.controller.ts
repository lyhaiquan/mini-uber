import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Roles } from "../auth/guards/roles.decorator";
import type { EnvironmentVariables } from "../config/env.validation";
import { PricingFacade } from "../pricing/pricing.facade";
import { Role } from "../users/dto/role.enum";
import { CreateRideDto } from "./dto/create-ride.dto";
import { QuoteRideDto } from "./dto/quote-ride.dto";
import type { QuoteResponseDto } from "./dto/quote-response.dto";
import type { RideDetailResponseDto } from "./dto/ride-detail-response.dto";
import type { RideResponseDto } from "./dto/ride-response.dto";
import { TransitionRideDto } from "./dto/transition-ride.dto";
import { ActorType, actorFromRole } from "./enums/actor-type.enum";
import { RidesFacade } from "./rides.facade";
import { RideTransitionService } from "./ride-transition.service";
import { RidesService } from "./rides.service";

const QUOTE_EXPIRES_IN_SECONDS = 60;

@Controller("rides")
export class RidesController {
  constructor(
    private readonly ridesService: RidesService,
    private readonly transitionService: RideTransitionService,
    private readonly ridesFacade: RidesFacade,
    private readonly pricingFacade: PricingFacade,
    private readonly configService: ConfigService<EnvironmentVariables, true>
  ) {}

  @Get("active")
  @Roles(Role.CUSTOMER)
  async getActive(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ data: RideResponseDto | null }> {
    const ride = await this.ridesFacade.getActiveRideForCustomer(user.userId);
    return { data: ride };
  }

  @Post("quote")
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async quote(
    @Body() dto: QuoteRideDto,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<{ data: QuoteResponseDto }> {
    if (
      dto.pickup.lat === dto.destination.lat &&
      dto.pickup.lng === dto.destination.lng
    ) {
      throw new BadRequestException({
        code: "QUOTE_INVALID_COORDINATES",
        message: "Pickup và destination phải khác nhau."
      });
    }

    const estimate = await this.pricingFacade.computeFareEstimate({
      pickup: { lat: dto.pickup.lat, lng: dto.pickup.lng },
      destination: { lat: dto.destination.lat, lng: dto.destination.lng }
    });

    return {
      data: {
        distanceMeters: estimate.distanceMeters,
        durationSeconds: estimate.durationSeconds,
        baseFareVnd: estimate.baseFareVnd,
        perKmVnd: this.configService.get("PRICING_PER_KM_VND", { infer: true }),
        perMinVnd: this.configService.get("PRICING_PER_MIN_VND", { infer: true }),
        surgeMultiplier: estimate.surgeMultiplier,
        totalVnd: estimate.totalVnd,
        currency: "VND",
        routeConfidence: estimate.routeConfidence,
        estimatedAt: new Date().toISOString(),
        expiresInSeconds: QUOTE_EXPIRES_IN_SECONDS
      }
    };
  }

  @Post()
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  async createRide(
    @Body() dto: CreateRideDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ data: RideResponseDto }> {
    const ride = await this.ridesService.createRide(user.userId, dto);
    return { data: ride };
  }

  @Get(":id")
  async getRide(
    @Param("id", new ParseUUIDPipe({ version: "4" })) rideId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ data: RideDetailResponseDto }> {
    const ride = await this.ridesFacade.getRideDetail(rideId, {
      userId: user.userId,
      role: user.role
    });
    return { data: ride };
  }

  @Post(":id/transitions")
  @HttpCode(HttpStatus.OK)
  async transitionRide(
    @Param("id", new ParseUUIDPipe({ version: "4" })) rideId: string,
    @Body() dto: TransitionRideDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ data: RideResponseDto }> {
    const actor = actorFromRole(user.role, user.userId);

    // SYSTEM actor must never originate from HTTP. actorFromRole only emits
    // CUSTOMER/DRIVER/ADMIN, but guard against future regressions.
    if (actor.type === ActorType.SYSTEM) {
      throw new ForbiddenException({
        code: "RIDE_FORBIDDEN_TRANSITION",
        message: "SYSTEM transitions cannot be requested via HTTP."
      });
    }

    // Note: REQUESTED is intentionally NOT pre-rejected here. The transition
    // map has no rule whose target is REQUESTED, so the state machine itself
    // will raise RIDE_INVALID_STATE (HTTP 409) — letting the spec-locked error
    // taxonomy and HTTP status flow through unchanged.
    const ride = await this.transitionService.transition(rideId, dto.toStatus, actor, {
      reason: dto.reason,
      expectedVersion: dto.expectedVersion
    });

    return { data: ride };
  }
}
