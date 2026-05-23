import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateRidesTables1747200002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "ride_status" AS ENUM (
        'REQUESTED',
        'MATCHING',
        'ACCEPTED',
        'DRIVER_ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_DRIVERS_FOUND'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "actor_type" AS ENUM (
        'CUSTOMER',
        'DRIVER',
        'ADMIN',
        'SYSTEM'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "rides" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "driver_user_id" uuid NULL,
        "status" "ride_status" NOT NULL DEFAULT 'REQUESTED',
        "pickup_lat" numeric(9,6) NOT NULL,
        "pickup_lng" numeric(9,6) NOT NULL,
        "pickup_address" text NOT NULL,
        "destination_lat" numeric(9,6) NOT NULL,
        "destination_lng" numeric(9,6) NOT NULL,
        "destination_address" text NOT NULL,
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "matching_started_at" timestamptz NULL,
        "accepted_at" timestamptz NULL,
        "driver_arrived_at" timestamptz NULL,
        "started_at" timestamptz NULL,
        "completed_at" timestamptz NULL,
        "cancelled_at" timestamptz NULL,
        "cancelled_by" "actor_type" NULL,
        "cancellation_reason" text NULL,
        "version" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "rides_customer_idx"
         ON "rides" ("customer_id", "created_at" DESC)`
    );

    await queryRunner.query(
      `CREATE INDEX "rides_driver_active_idx"
         ON "rides" ("driver_user_id", "status")
         WHERE "driver_user_id" IS NOT NULL`
    );

    await queryRunner.query(
      `CREATE INDEX "rides_active_status_idx"
         ON "rides" ("status")
         WHERE "status" IN (
           'REQUESTED', 'MATCHING', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS'
         )`
    );

    await queryRunner.query(`
      CREATE TABLE "ride_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ride_id" uuid NOT NULL,
        "from_status" "ride_status" NULL,
        "to_status" "ride_status" NOT NULL,
        "actor_type" "actor_type" NOT NULL,
        "actor_id" uuid NULL,
        "reason" text NULL,
        "metadata" jsonb NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ride_events_ride_fk"
          FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "ride_events_ride_idx"
         ON "ride_events" ("ride_id", "occurred_at")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ride_events_ride_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ride_events"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "rides_active_status_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "rides_driver_active_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "rides_customer_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rides"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "actor_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ride_status"`);
  }
}
