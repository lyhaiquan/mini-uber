import { ForbiddenException, Injectable } from "@nestjs/common";

import { PricingFacade } from "../pricing/pricing.facade";
import { UsersFacade } from "../users/users.facade";
import { Role } from "../users/dto/role.enum";
import type {
  DriverSummaryDto,
  PricingSummaryDto,
  RideDetailResponseDto
} from "./dto/ride-detail-response.dto";
import type { RideResponseDto } from "./dto/ride-response.dto";
import type { RideSummaryDto } from "./dto/ride-summary.dto";
import { systemActor } from "./enums/actor-type.enum";
import { isMatchingEligible, RideStatus } from "./enums/ride-status.enum";
import { RideNotFoundError, RideNotMatchingEligibleError } from "./errors/ride-errors";
import { RideTransitionService } from "./ride-transition.service";
import { RidesService } from "./rides.service";
import { rideToResponseDto, rideToSummaryDto } from "./rides.mapper";

// Driver identity is only revealed to the customer once the ride is at least ACCEPTED.
// Earlier statuses (REQUESTED, MATCHING) must not leak a candidate driver's info even
// if a row gets `driver_user_id` populated by a race.
const DRIVER_VISIBLE_STATUSES: ReadonlySet<RideStatus> = new Set([
  RideStatus.ACCEPTED,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.IN_PROGRESS,
  RideStatus.COMPLETED
]);

export interface RideRequester {
  userId: string;
  role: Role;
}

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
    private readonly transitionService: RideTransitionService,
    private readonly usersFacade: UsersFacade,
    private readonly pricingFacade: PricingFacade
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

  // Used by the ride-tracking gateway to forward a driver's location update
  // into the right ride:{rideId} room. Returns null when the driver is not
  // currently on an ACCEPTED+ ride (e.g. just went online but no offer yet).
  async findAssignedActiveRideByDriver(driverUserId: string): Promise<RideSummaryDto | null> {
    const ride = await this.ridesService.findAssignedActiveRideByDriver(driverUserId);
    return ride === null ? null : rideToSummaryDto(ride);
  }

  // Full-shape variant used by the customer-facing GET /rides/active endpoint.
  async getActiveRideForCustomer(customerId: string): Promise<RideResponseDto | null> {
    const ride = await this.ridesService.findActiveByCustomer(customerId);
    return ride === null ? null : rideToResponseDto(ride);
  }

  // Read-only ride view for GET /rides/:id. Performs object-level authorization
  // (customer-own / driver-assigned / admin) and only attaches driver identity once
  // the ride is at status ACCEPTED+ to avoid leaking a candidate driver during MATCHING.
  async getRideDetail(
    rideId: string,
    requester: RideRequester
  ): Promise<RideDetailResponseDto> {
    const ride = await this.ridesService.findById(rideId);
    if (ride === null) {
      throw new RideNotFoundError();
    }

    if (requester.role === Role.CUSTOMER && ride.customerId !== requester.userId) {
      throw new ForbiddenException({
        code: "RIDE_FORBIDDEN_ACCESS",
        message: "You are not allowed to view this ride."
      });
    }
    if (requester.role === Role.DRIVER && ride.driverUserId !== requester.userId) {
      throw new ForbiddenException({
        code: "RIDE_FORBIDDEN_ACCESS",
        message: "You are not allowed to view this ride."
      });
    }

    const base = rideToResponseDto(ride);

    let driver: DriverSummaryDto | null = null;
    if (ride.driverUserId !== null && DRIVER_VISIBLE_STATUSES.has(ride.status)) {
      const driverUser = await this.usersFacade.getUserById(ride.driverUserId);
      if (driverUser !== null) {
        driver = { id: driverUser.id, maskedEmail: maskEmail(driverUser.email) };
      }
    }

    const snapshot = await this.pricingFacade.getSnapshotForRide(rideId);
    const pricing: PricingSummaryDto | null = snapshot === null
      ? null
      : {
          currency: snapshot.currency,
          totalVnd: snapshot.totalVnd,
          distanceMeters: snapshot.distanceMeters,
          durationSeconds: snapshot.durationSeconds,
          surgeMultiplier: snapshot.surgeMultiplier,
          baseFareVnd: snapshot.baseFareVnd,
          surgeAmountVnd: snapshot.surgeAmountVnd,
          routePolyline: snapshot.routePolyline,
          routePolylineFormat: snapshot.routePolylineFormat
        };

    return { ...base, driver, pricing };
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

// Mask local-part of email except the first character to hide driver identity
// while still letting customer recognize who is assigned. "alice@x.com" → "a***@x.com".
// Local-parts shorter than 2 chars degrade to "*@domain" — never reveals the full local.
function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return "***";
  }
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const head = local.length === 1 ? "" : local[0];
  return `${head}***${domain}`;
}
