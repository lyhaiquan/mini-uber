import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateWalletsAndPaymentsTables1778951000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "kind" text NOT NULL CHECK ("kind" IN ('CUSTOMER', 'DRIVER', 'PLATFORM')),
        "currency" text NOT NULL DEFAULT 'VND' CHECK ("currency" = 'VND'),
        "balance_vnd" bigint NOT NULL DEFAULT 0 CHECK ("balance_vnd" >= 0),
        "version" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "wallets_user_kind_unique" ON "wallets" ("user_id", "kind") WHERE "user_id" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "wallets_platform_unique" ON "wallets" ("kind") WHERE "kind" = 'PLATFORM'`
    );

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ride_id" uuid NOT NULL UNIQUE REFERENCES "rides"("id") ON DELETE RESTRICT,
        "pricing_snapshot_id" uuid NULL REFERENCES "pricing_snapshots"("id") ON DELETE RESTRICT,
        "idempotency_key" text NOT NULL UNIQUE CHECK (char_length("idempotency_key") BETWEEN 1 AND 128),
        "status" text NOT NULL CHECK ("status" IN ('PENDING', 'SUCCEEDED', 'FAILED_INSUFFICIENT_BALANCE', 'FAILED_MISSING_SNAPSHOT')),
        "customer_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "driver_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "currency" text NOT NULL DEFAULT 'VND' CHECK ("currency" = 'VND'),
        "total_vnd" bigint NOT NULL CHECK ("total_vnd" >= 0),
        "driver_share_vnd" bigint NOT NULL CHECK ("driver_share_vnd" >= 0),
        "platform_share_vnd" bigint NOT NULL CHECK ("platform_share_vnd" >= 0),
        "driver_share_bps" int NOT NULL CHECK ("driver_share_bps" BETWEEN 0 AND 10000),
        "platform_share_bps" int NOT NULL CHECK ("platform_share_bps" BETWEEN 0 AND 10000),
        "failure_reason" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz NULL,
        CHECK ("driver_share_vnd" + "platform_share_vnd" <= "total_vnd"),
        CHECK ("status" = 'FAILED_MISSING_SNAPSHOT' OR "pricing_snapshot_id" IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "payments_customer_idx" ON "payments" ("customer_user_id", "created_at" DESC)`
    );
    await queryRunner.query(
      `CREATE INDEX "payments_driver_idx" ON "payments" ("driver_user_id", "created_at" DESC)`
    );

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE RESTRICT,
        "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE RESTRICT,
        "entry_type" text NOT NULL CHECK ("entry_type" IN ('DEBIT', 'CREDIT')),
        "amount_vnd" bigint NOT NULL CHECK ("amount_vnd" > 0),
        "balance_after_vnd" bigint NOT NULL CHECK ("balance_after_vnd" >= 0),
        "memo" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ledger_entries_payment_idx" ON "ledger_entries" ("payment_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "ledger_entries_wallet_idx" ON "ledger_entries" ("wallet_id", "created_at" DESC)`
    );
    await queryRunner.query(`INSERT INTO "wallets" ("kind", "balance_vnd") VALUES ('PLATFORM', 0)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets"`);
  }
}
