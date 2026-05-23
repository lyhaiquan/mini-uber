import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateDriversTable1747200003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "drivers" (
        "driver_id" uuid PRIMARY KEY,
        "is_online" boolean NOT NULL DEFAULT false,
        "online_since" timestamptz NULL,
        "last_seen_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "drivers_user_fk"
          FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "drivers_is_online_idx"
        ON "drivers" ("driver_id")
        WHERE "is_online" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "drivers_is_online_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drivers"`);
  }
}

