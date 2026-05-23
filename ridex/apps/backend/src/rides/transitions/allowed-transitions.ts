import { ActorType } from "../enums/actor-type.enum";
import { RideStatus } from "../enums/ride-status.enum";

export type OwnershipRequirement = "customer" | "driver" | "none";

export interface AllowedActor {
  type: ActorType;
  ownership: OwnershipRequirement;
}

export interface TransitionRule {
  from: RideStatus;
  to: RideStatus;
  allowed: ReadonlyArray<AllowedActor>;
}

// Single source of truth for the ride state machine.
// Every transition in this array is allowed; any transition not listed is
// rejected with RIDE_INVALID_STATE. Each entry whitelists the actor types
// that may perform it and whether they must own the ride (customer) or be
// the assigned driver.
export const ALLOWED_TRANSITIONS: ReadonlyArray<TransitionRule> = [
  // From REQUESTED
  {
    from: RideStatus.REQUESTED,
    to: RideStatus.MATCHING,
    allowed: [{ type: ActorType.SYSTEM, ownership: "none" }]
  },
  {
    from: RideStatus.REQUESTED,
    to: RideStatus.CANCELLED,
    allowed: [
      { type: ActorType.CUSTOMER, ownership: "customer" },
      { type: ActorType.ADMIN, ownership: "none" }
    ]
  },
  // From MATCHING
  {
    from: RideStatus.MATCHING,
    to: RideStatus.ACCEPTED,
    allowed: [{ type: ActorType.SYSTEM, ownership: "none" }]
  },
  {
    from: RideStatus.MATCHING,
    to: RideStatus.NO_DRIVERS_FOUND,
    allowed: [{ type: ActorType.SYSTEM, ownership: "none" }]
  },
  {
    from: RideStatus.MATCHING,
    to: RideStatus.CANCELLED,
    allowed: [
      { type: ActorType.CUSTOMER, ownership: "customer" },
      { type: ActorType.ADMIN, ownership: "none" }
    ]
  },
  // From ACCEPTED
  {
    from: RideStatus.ACCEPTED,
    to: RideStatus.DRIVER_ARRIVED,
    allowed: [
      { type: ActorType.DRIVER, ownership: "driver" },
      { type: ActorType.ADMIN, ownership: "none" }
    ]
  },
  {
    from: RideStatus.ACCEPTED,
    to: RideStatus.CANCELLED,
    allowed: [
      { type: ActorType.CUSTOMER, ownership: "customer" },
      { type: ActorType.DRIVER, ownership: "driver" },
      { type: ActorType.ADMIN, ownership: "none" }
    ]
  },
  // From DRIVER_ARRIVED
  {
    from: RideStatus.DRIVER_ARRIVED,
    to: RideStatus.IN_PROGRESS,
    allowed: [
      { type: ActorType.DRIVER, ownership: "driver" },
      { type: ActorType.ADMIN, ownership: "none" }
    ]
  },
  {
    from: RideStatus.DRIVER_ARRIVED,
    to: RideStatus.CANCELLED,
    allowed: [
      { type: ActorType.CUSTOMER, ownership: "customer" },
      { type: ActorType.DRIVER, ownership: "driver" },
      { type: ActorType.ADMIN, ownership: "none" }
    ]
  },
  // From IN_PROGRESS
  {
    from: RideStatus.IN_PROGRESS,
    to: RideStatus.COMPLETED,
    allowed: [
      { type: ActorType.DRIVER, ownership: "driver" },
      { type: ActorType.ADMIN, ownership: "none" }
    ]
  },
  {
    from: RideStatus.IN_PROGRESS,
    to: RideStatus.CANCELLED,
    allowed: [{ type: ActorType.ADMIN, ownership: "none" }]
  }
];

export function findTransitionRule(
  from: RideStatus,
  to: RideStatus
): TransitionRule | undefined {
  return ALLOWED_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}
