import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import { ActorType } from "../enums/actor-type.enum";
import { RideStatus } from "../enums/ride-status.enum";

// Postgres returns numeric() as string by default. This transformer keeps
// the in-memory representation as `number` while writing/reading PG numeric.
const numericTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value)
};

@Entity({ name: "rides" })
export class Ride {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("rides_customer_idx")
  @Column({ name: "customer_id", type: "uuid" })
  customerId!: string;

  @Column({ name: "driver_user_id", type: "uuid", nullable: true })
  driverUserId!: string | null;

  @Column({
    type: "enum",
    enum: RideStatus,
    enumName: "ride_status",
    default: RideStatus.REQUESTED
  })
  status!: RideStatus;

  @Column({
    name: "pickup_lat",
    type: "numeric",
    precision: 9,
    scale: 6,
    transformer: numericTransformer
  })
  pickupLat!: number;

  @Column({
    name: "pickup_lng",
    type: "numeric",
    precision: 9,
    scale: 6,
    transformer: numericTransformer
  })
  pickupLng!: number;

  @Column({ name: "pickup_address", type: "text" })
  pickupAddress!: string;

  @Column({
    name: "destination_lat",
    type: "numeric",
    precision: 9,
    scale: 6,
    transformer: numericTransformer
  })
  destinationLat!: number;

  @Column({
    name: "destination_lng",
    type: "numeric",
    precision: 9,
    scale: 6,
    transformer: numericTransformer
  })
  destinationLng!: number;

  @Column({ name: "destination_address", type: "text" })
  destinationAddress!: string;

  @Column({ name: "requested_at", type: "timestamptz" })
  requestedAt!: Date;

  @Column({ name: "matching_started_at", type: "timestamptz", nullable: true })
  matchingStartedAt!: Date | null;

  @Column({ name: "accepted_at", type: "timestamptz", nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: "driver_arrived_at", type: "timestamptz", nullable: true })
  driverArrivedAt!: Date | null;

  @Column({ name: "started_at", type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt!: Date | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt!: Date | null;

  @Column({
    name: "cancelled_by",
    type: "enum",
    enum: ActorType,
    enumName: "actor_type",
    nullable: true
  })
  cancelledBy!: ActorType | null;

  @Column({ name: "cancellation_reason", type: "text", nullable: true })
  cancellationReason!: string | null;

  @Column({ type: "integer", default: 0 })
  version!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
