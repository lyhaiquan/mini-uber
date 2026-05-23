import { Controller, Get, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.types";
import { Roles } from "../auth/guards/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RidesFacade } from "../rides/rides.facade";
import { Role } from "../users/dto/role.enum";
import type { DriverOfferResponseDto } from "./dto/driver-offer-response.dto";
import { MatchingFacade } from "./matching.facade";
import type { RideDetailResponseDto } from "../rides/dto/ride-detail-response.dto";

// Driver-side REST endpoints that need to read from both matching and rides.
// They live in matching.module because MatchingModule already imports
// RidesModule; placing them in DriversModule would create a cycle.
@Controller("drivers/me")
@Roles(Role.DRIVER)
export class DriverMeController {
  constructor(
    private readonly matchingFacade: MatchingFacade,
    private readonly ridesFacade: RidesFacade
  ) {}

  // REST fallback for the offer modal. The WS push (ride.offer.received) is
  // the primary path; this endpoint exists so a driver who reloads while an
  // offer is in flight still sees it before the socket reconnects.
  @Get("offers/current")
  async getCurrentOffer(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ data: DriverOfferResponseDto | null }> {
    return { data: await this.matchingFacade.getCurrentOfferForDriver(user.userId) };
  }

  // Used by the driver app on launch / reload to decide whether to land
  // the user on the home screen or jump straight to the in-ride screen.
  // Returns null when the driver is between rides.
  @Get("active-ride")
  async getActiveRide(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ data: RideDetailResponseDto | null }> {
    const summary = await this.ridesFacade.findAssignedActiveRideByDriver(user.userId);
    if (summary === null) {
      return { data: null };
    }

    // Reuse getRideDetail to apply the same masked-driver / pricing-summary
    // shape the customer's ride-tracking screen gets. The DRIVER role
    // check inside the facade authorizes against driverUserId === user.userId
    // so this is safe.
    try {
      const detail = await this.ridesFacade.getRideDetail(summary.id, {
        userId: user.userId,
        role: Role.DRIVER
      });
      return { data: detail };
    } catch (error: unknown) {
      // The ride was finalized between the two reads — treat as no active.
      if (error instanceof NotFoundException) {
        return { data: null };
      }
      throw error;
    }
  }
}
