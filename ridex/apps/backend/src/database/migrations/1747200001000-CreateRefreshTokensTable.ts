import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateRefreshTokensTable1747200001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz NULL,
        "revoked_reason" varchar(64) NULL,
        "replaced_by_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "refresh_tokens_user_fk"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" ("family_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "refresh_tokens_active_idx"
         ON "refresh_tokens" ("user_id")
         WHERE "revoked_at" IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "refresh_tokens_active_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "refresh_tokens_family_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "refresh_tokens_user_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
