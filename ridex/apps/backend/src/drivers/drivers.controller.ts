import { Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.types";
import { Roles } from "../auth/guards/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { getRequestId, type RequestWithCorrelationId } from "../common/request-context";
import { Role } from "../users/dto/role.enum";
import type { DriverAvailabilityDto } from "./dto/driver-availability.dto";
import { DriversFacade } from "./drivers.facade";

@Controller("drivers")
@Roles(Role.DRIVER)
export class DriversController {
  constructor(private readonly driversFacade: DriversFacade) {}

  @Post("me/online")
  @HttpCode(HttpStatus.NO_CONTENT)
  async goOnline(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithCorrelationId
  ): Promise<void> {
    await this.driversFacade.setOnline(user.userId, getRequestId(request));
  }

  @Post("me/offline")
  @HttpCode(HttpStatus.NO_CONTENT)
  async goOffline(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithCorrelationId
  ): Promise<void> {
    await this.driversFacade.setOffline(user.userId, getRequestId(request));
  }

  @Get("me/availability")
  async getAvailability(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ data: DriverAvailabilityDto }> {
    return {
      data: await this.driversFacade.getAvailability(user.userId)
    };
  }
}

