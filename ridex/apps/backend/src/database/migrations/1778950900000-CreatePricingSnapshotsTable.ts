import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreatePricingSnapshotsTable1778950900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pricing_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ride_id" uuid NOT NULL UNIQUE,
        "currency" text NOT NULL DEFAULT 'VND' CHECK ("currency" = 'VND'),
        "pickup_h3_r8" text NOT NULL,
        "distance_meters" int NOT NULL CHECK ("distance_meters" >= 0),
        "duration_seconds" int NOT NULL CHECK ("duration_seconds" >= 0),
        "route_confidence" text NOT NULL CHECK ("route_confidence" IN ('high', 'low')),
        "base_fare_vnd" bigint NOT NULL CHECK ("base_fare_vnd" >= 0),
        "distance_fee_vnd" bigint NOT NULL CHECK ("distance_fee_vnd" >= 0),
        "duration_fee_vnd" bigint NOT NULL CHECK ("duration_fee_vnd" >= 0),
        "subtotal_vnd" bigint NOT NULL CHECK ("subtotal_vnd" >= 0),
        "surge_multiplier" numeric(4, 3) NOT NULL CHECK ("surge_multiplier" >= 1.0),
        "surge_amount_vnd" bigint NOT NULL CHECK ("surge_amount_vnd" >= 0),
        "minimum_fare_vnd" bigint NOT NULL CHECK ("minimum_fare_vnd" >= 0),
        "total_vnd" bigint NOT NULL CHECK ("total_vnd" >= 0),
        "computed_at" timestamptz NOT NULL DEFAULT now(),
        "version" int NOT NULL DEFAULT 0,
        CONSTRAINT "pricing_snapshots_ride_fk"
          FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT
      )
    `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pricing_snapshots"`);
  }
}
