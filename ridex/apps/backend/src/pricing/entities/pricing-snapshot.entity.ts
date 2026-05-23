import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

import type { PolylineFormat, RouteConfidence } from "../../routing/routing.types";

// Postgres returns bigint as string by default; numeric() also as string.
// Convert both to JS number. VND amounts fit safely in Number.MAX_SAFE_INTEGER
// for any plausible ride (max safe ≈ 9e15 đồng, way beyond any fare).
const bigintTransformer = {
  to: (value: number): number => value,
  from: (value: string | number | null): number =>
    toNonNullNumber(value, "pricing snapshot bigint")
};

const numericTransformer = {
  to: (value: number): number => value,
  from: (value: string | number | null): number =>
    toNonNullNumber(value, "pricing snapshot numeric")
};

function toNonNullNumber(value: string | number | null, label: string): number {
  if (value === null) {
    throw new Error(`${label} column returned null`);
  }
  return typeof value === "number" ? value : Number(value);
}

@Entity({ name: "pricing_snapshots" })
export class PricingSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "ride_id", type: "uuid", unique: true })
  rideId!: string;

  @Column({ type: "text", default: "VND" })
  currency!: string;

  @Column({ name: "pickup_h3_r8", type: "text" })
  pickupH3R8!: string;

  @Column({ name: "distance_meters", type: "int" })
  distanceMeters!: number;

  @Column({ name: "duration_seconds", type: "int" })
  durationSeconds!: number;

  @Column({ name: "route_confidence", type: "text" })
  routeConfidence!: RouteConfidence;

  @Column({ name: "base_fare_vnd", type: "bigint", transformer: bigintTransformer })
  baseFareVnd!: number;

  @Column({ name: "distance_fee_vnd", type: "bigint", transformer: bigintTransformer })
  distanceFeeVnd!: number;

  @Column({ name: "duration_fee_vnd", type: "bigint", transformer: bigintTransformer })
  durationFeeVnd!: number;

  @Column({ name: "subtotal_vnd", type: "bigint", transformer: bigintTransformer })
  subtotalVnd!: number;

  @Column({
    name: "surge_multiplier",
    type: "numeric",
    precision: 4,
    scale: 3,
    transformer: numericTransformer
  })
  surgeMultiplier!: number;

  @Column({ name: "surge_amount_vnd", type: "bigint", transformer: bigintTransformer })
  surgeAmountVnd!: number;

  @Column({ name: "minimum_fare_vnd", type: "bigint", transformer: bigintTransformer })
  minimumFareVnd!: number;

  @Column({ name: "total_vnd", type: "bigint", transformer: bigintTransformer })
  totalVnd!: number;

  @Column({ name: "route_polyline", type: "text", nullable: true })
  routePolyline!: string | null;

  @Column({ name: "route_polyline_format", type: "text", nullable: true })
  routePolylineFormat!: PolylineFormat | null;

  @Column({ name: "computed_at", type: "timestamptz", default: () => "now()" })
  computedAt!: Date;

  @Column({ type: "int", default: 0 })
  version!: number;
}
