import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post
} from "@nestjs/common";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Roles } from "../auth/guards/roles.decorator";
import { Role } from "../users/dto/role.enum";
import { CreateRideDto } from "./dto/create-ride.dto";
import type { RideResponseDto } from "./dto/ride-response.dto";
import { TransitionRideDto } from "./dto/transition-ride.dto";
import { ActorType, actorFromRole } from "./enums/actor-type.enum";
import { RideTransitionService } from "./ride-transition.service";
import { RidesService } from "./rides.service";

@Controller("rides")
export class RidesController {
  constructor(
    private readonly ridesService: RidesService,
    private readonly transitionService: RideTransitionService
  ) {}

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
