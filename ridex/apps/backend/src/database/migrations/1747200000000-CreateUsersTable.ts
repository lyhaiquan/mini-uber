import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateUsersTable1747200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(254) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role" varchar(32) NOT NULL DEFAULT 'CUSTOMER',
        "failed_login_count" integer NOT NULL DEFAULT 0,
        "first_failed_login_at" timestamptz NULL,
        "locked_until" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "users_role_check"
          CHECK ("role" IN ('CUSTOMER', 'DRIVER', 'ADMIN'))
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_unique_idx" ON "users" (LOWER("email"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "users_email_unique_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
