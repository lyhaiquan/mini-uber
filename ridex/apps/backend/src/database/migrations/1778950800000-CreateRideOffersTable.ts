import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateRideOffersTable1778950800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "matching_offer_status" AS ENUM (
        'OFFERED',
        'ACCEPTED',
        'REJECTED',
        'TIMED_OUT',
        'CANCELLED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ride_offers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ride_id" uuid NOT NULL,
        "driver_user_id" uuid NOT NULL,
        "status" "matching_offer_status" NOT NULL DEFAULT 'OFFERED',
        "attempt_number" int NOT NULL CHECK ("attempt_number" >= 1),
        "score" numeric(10, 6) NOT NULL,
        "distance_meters" int NOT NULL CHECK ("distance_meters" >= 0),
        "duration_seconds" int NOT NULL CHECK ("duration_seconds" >= 0),
        "route_confidence" text NOT NULL CHECK ("route_confidence" IN ('high', 'low')),
        "offered_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "responded_at" timestamptz NULL,
        "finalized_at" timestamptz NULL,
        "version" int NOT NULL DEFAULT 0,
        CONSTRAINT "ride_offers_ride_fk"
          FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE RESTRICT,
        CONSTRAINT "ride_offers_driver_user_fk"
          FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "ride_offers_ride_idx"
         ON "ride_offers" ("ride_id", "attempt_number")`
    );

    await queryRunner.query(
      `CREATE INDEX "ride_offers_driver_open_idx"
         ON "ride_offers" ("driver_user_id") WHERE "status" = 'OFFERED'`
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "ride_offers_one_active_per_ride"
         ON "ride_offers" ("ride_id") WHERE "status" = 'OFFERED'`
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "ride_offers_one_active_per_driver"
         ON "ride_offers" ("driver_user_id") WHERE "status" = 'OFFERED'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ride_offers_one_active_per_driver"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ride_offers_one_active_per_ride"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ride_offers_driver_open_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ride_offers_ride_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ride_offers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "matching_offer_status"`);
  }
}

