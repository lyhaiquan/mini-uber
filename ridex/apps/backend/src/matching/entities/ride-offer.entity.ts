import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from "typeorm";

import type { RouteConfidence } from "../../routing/routing.types";
import { OfferStatus } from "../enums/offer-status.enum";

const scoreTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value)
};

@Entity({ name: "ride_offers" })
@Index("ride_offers_ride_idx", ["rideId", "attemptNumber"])
@Index("ride_offers_driver_open_idx", ["driverUserId"], {
  where: "\"status\" = 'OFFERED'"
})
@Index("ride_offers_one_active_per_ride", ["rideId"], {
  unique: true,
  where: "\"status\" = 'OFFERED'"
})
@Index("ride_offers_one_active_per_driver", ["driverUserId"], {
  unique: true,
  where: "\"status\" = 'OFFERED'"
})
export class RideOffer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "ride_id", type: "uuid" })
  rideId!: string;

  @Column({ name: "driver_user_id", type: "uuid" })
  driverUserId!: string;

  @Column({
    type: "enum",
    enum: OfferStatus,
    enumName: "matching_offer_status",
    default: OfferStatus.OFFERED
  })
  status!: OfferStatus;

  @Column({ name: "attempt_number", type: "int" })
  attemptNumber!: number;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 6,
    transformer: scoreTransformer
  })
  score!: number;

  @Column({ name: "distance_meters", type: "int" })
  distanceMeters!: number;

  @Column({ name: "duration_seconds", type: "int" })
  durationSeconds!: number;

  @Column({ name: "route_confidence", type: "text" })
  routeConfidence!: RouteConfidence;

  @Column({ name: "offered_at", type: "timestamptz" })
  offeredAt!: Date;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt!: Date | null;

  @Column({ name: "finalized_at", type: "timestamptz", nullable: true })
  finalizedAt!: Date | null;

  @Column({ type: "int", default: 0 })
  version!: number;
}

