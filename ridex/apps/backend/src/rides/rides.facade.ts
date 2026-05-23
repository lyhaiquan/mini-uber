import { Injectable } from "@nestjs/common";

import type { RideResponseDto } from "./dto/ride-response.dto";
import type { RideSummaryDto } from "./dto/ride-summary.dto";
import { systemActor } from "./enums/actor-type.enum";
import { isMatchingEligible, RideStatus } from "./enums/ride-status.enum";
import { RideNotFoundError, RideNotMatchingEligibleError } from "./errors/ride-errors";
import { RideTransitionService } from "./ride-transition.service";
import { RidesService } from "./rides.service";
import { rideToResponseDto, rideToSummaryDto } from "./rides.mapper";

export interface RidePaymentDto {
  id: string;
  customerId: string;
  driverUserId: string | null;
  status: RideStatus;
}

export interface RideDashboardCounts {
  active: number;
  completedLast24h: number;
  cancelledLast24h: number;
  noDriversFoundLast24h: number;
  totalLast24h: number;
}

@Injectable()
export class RidesFacade {
  constructor(
    private readonly ridesService: RidesService,
    private readonly transitionService: RideTransitionService
  ) {}

  // --- Read API (cross-module consumers) ------------------------------------

  async getRideSummary(rideId: string): Promise<RideSummaryDto | null> {
    const ride = await this.ridesService.findById(rideId);
    return ride === null ? null : rideToSummaryDto(ride);
  }

  // Used by the matching engine to fetch a ride that is awaiting a driver.
  // Throws if the ride is in any status other than REQUESTED or MATCHING —
  // matching should never operate on an already-assigned or terminal ride.
  async getRideForMatching(rideId: string): Promise<RideSummaryDto> {
    const ride = await this.ridesService.findById(rideId);
    if (ride === null) {
      throw new RideNotFoundError();
    }

    if (!isMatchingEligible(ride.status)) {
      throw new RideNotMatchingEligibleError(ride.status);
    }

    return rideToSummaryDto(ride);
  }

  // Used by matching to dedupe (one active ride per customer) and by chat
  // to verify a customer has a ride to converse about.
  async findActiveRideForCustomer(customerId: string): Promise<RideSummaryDto | null> {
    const ride = await this.ridesService.findActiveByCustomer(customerId);
    return ride === null ? null : rideToSummaryDto(ride);
  }

  // Full-shape variant used by the customer-facing GET /rides/active endpoint.
  async getActiveRideForCustomer(customerId: string): Promise<RideResponseDto | null> {
    const ride = await this.ridesService.findActiveByCustomer(customerId);
    return ride === null ? null : rideToResponseDto(ride);
  }

  async getDashboardCounts(since: Date): Promise<RideDashboardCounts> {
    const [active, completedLast24h, cancelledLast24h, noDriversFoundLast24h, totalLast24h] =
      await Promise.all([
        this.ridesService.countActive(),
        this.ridesService.countByStatusSince(since, [RideStatus.COMPLETED]),
        this.ridesService.countByStatusSince(since, [RideStatus.CANCELLED]),
        this.ridesService.countByStatusSince(since, [RideStatus.NO_DRIVERS_FOUND]),
        this.ridesService.countTotalSince(since)
      ]);
    return { active, completedLast24h, cancelledLast24h, noDriversFoundLast24h, totalLast24h };
  }

  async getRideForPayment(rideId: string): Promise<RidePaymentDto | null> {
    const ride = await this.ridesService.findById(rideId);
    if (ride === null) {
      return null;
    }

    return {
      id: ride.id,
      customerId: ride.customerId,
      driverUserId: ride.driverUserId,
      status: ride.status
    };
  }

  // --- Internal SYSTEM transitions used by matching / scheduled jobs --------

  async markMatching(rideId: string): Promise<RideResponseDto> {
    return this.transitionService.transition(rideId, RideStatus.MATCHING, systemActor());
  }

  async assignDriver(rideId: string, driverUserId: string): Promise<RideResponseDto> {
    return this.transitionService.transition(rideId, RideStatus.ACCEPTED, systemActor(), {
      driverUserId
    });
  }

  async markNoDriversFound(rideId: string, reason?: string): Promise<RideResponseDto> {
    return this.transitionService.transition(rideId, RideStatus.NO_DRIVERS_FOUND, systemActor(), {
      reason
    });
  }
}
