import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";

import type { RideStatus } from "../enums/ride-status.enum";

export class RideNotFoundError extends NotFoundException {
  constructor() {
    super({
      code: "RIDE_NOT_FOUND",
      message: "Ride not found."
    });
  }
}

export class RideInvalidTransitionError extends ConflictException {
  constructor(from: RideStatus, to: RideStatus) {
    super({
      code: "RIDE_INVALID_STATE",
      message: `Transition from ${from} to ${to} is not allowed.`
    });
  }
}

export class RideForbiddenTransitionError extends ForbiddenException {
  constructor() {
    super({
      code: "RIDE_FORBIDDEN_TRANSITION",
      message: "You are not allowed to perform this ride transition."
    });
  }
}

export class RideVersionConflictError extends ConflictException {
  constructor() {
    super({
      code: "RIDE_VERSION_CONFLICT",
      message: "Ride was modified concurrently. Refresh and retry with the latest version."
    });
  }
}

export class RideNotMatchingEligibleError extends ConflictException {
  constructor(currentStatus: RideStatus) {
    super({
      code: "RIDE_NOT_MATCHING_ELIGIBLE",
      message: `Ride in status ${currentStatus} is not eligible for matching.`
    });
  }
}
