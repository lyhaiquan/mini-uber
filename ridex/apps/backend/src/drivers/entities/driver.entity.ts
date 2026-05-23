import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "drivers" })
@Index("drivers_is_online_idx", ["driverId"], { where: '"is_online" = true' })
export class Driver {
  @PrimaryColumn({ name: "driver_id", type: "uuid" })
  driverId!: string;

  @Column({ name: "is_online", type: "boolean", default: false })
  isOnline!: boolean;

  @Column({ name: "online_since", type: "timestamptz", nullable: true })
  onlineSince!: Date | null;

  @Column({ name: "last_seen_at", type: "timestamptz", nullable: true })
  lastSeenAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

