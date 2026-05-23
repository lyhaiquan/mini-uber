import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

import { ActorType } from "../enums/actor-type.enum";
import { RideStatus } from "../enums/ride-status.enum";

@Entity({ name: "ride_events" })
@Index("ride_events_ride_idx", ["rideId", "occurredAt"])
export class RideEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "ride_id", type: "uuid" })
  rideId!: string;

  @Column({
    name: "from_status",
    type: "enum",
    enum: RideStatus,
    enumName: "ride_status",
    nullable: true
  })
  fromStatus!: RideStatus | null;

  @Column({
    name: "to_status",
    type: "enum",
    enum: RideStatus,
    enumName: "ride_status"
  })
  toStatus!: RideStatus;

  @Column({
    name: "actor_type",
    type: "enum",
    enum: ActorType,
    enumName: "actor_type"
  })
  actorType!: ActorType;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId!: string | null;

  @Column({ type: "text", nullable: true })
  reason!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: "occurred_at", type: "timestamptz", default: () => "now()" })
  occurredAt!: Date;
}
