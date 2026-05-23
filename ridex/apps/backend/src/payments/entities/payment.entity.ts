import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

import { PaymentStatus } from "../enums/payment-status.enum";

const bigintTransformer = {
  to: (value: number): number => value,
  from: (value: string | number | null): number => {
    if (value === null) {
      throw new Error("payment bigint column returned null");
    }
    return typeof value === "number" ? value : Number(value);
  }
};

@Entity({ name: "payments" })
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "ride_id", type: "uuid", unique: true })
  rideId!: string;

  @Column({ name: "pricing_snapshot_id", type: "uuid", nullable: true })
  pricingSnapshotId!: string | null;

  @Column({ name: "idempotency_key", type: "text", unique: true })
  idempotencyKey!: string;

  @Column({ type: "text" })
  status!: PaymentStatus;

  @Column({ name: "customer_user_id", type: "uuid" })
  customerUserId!: string;

  @Column({ name: "driver_user_id", type: "uuid" })
  driverUserId!: string;

  @Column({ type: "text", default: "VND" })
  currency!: string;

  @Column({ name: "total_vnd", type: "bigint", transformer: bigintTransformer })
  totalVnd!: number;

  @Column({ name: "driver_share_vnd", type: "bigint", transformer: bigintTransformer })
  driverShareVnd!: number;

  @Column({ name: "platform_share_vnd", type: "bigint", transformer: bigintTransformer })
  platformShareVnd!: number;

  @Column({ name: "driver_share_bps", type: "int" })
  driverShareBps!: number;

  @Column({ name: "platform_share_bps", type: "int" })
  platformShareBps!: number;

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt!: Date | null;
}
