import { hash as argon2Hash } from "@node-rs/argon2";
import { type MigrationInterface, type QueryRunner } from "typeorm";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ADMIN_BOOTSTRAP_EMAIL_LENGTH = 254;
const MIN_ADMIN_BOOTSTRAP_PASSWORD_LENGTH = 12;
const MAX_ADMIN_BOOTSTRAP_PASSWORD_LENGTH = 128;

export class SeedAdminUser1778951100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

    if (email === undefined || email.length === 0 || password === undefined || password.length === 0) {
      console.warn(
        "[migration:SeedAdminUser] Skipped — ADMIN_BOOTSTRAP_EMAIL or ADMIN_BOOTSTRAP_PASSWORD not set."
      );
      return;
    }

    validateAdminBootstrapInput(email, password);

    const passwordHash = await argon2Hash(password, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });

    await queryRunner.query(
      `INSERT INTO "users" ("email", "password_hash", "role")
       VALUES ($1, $2, 'ADMIN')
       ON CONFLICT ((LOWER("email"))) DO NOTHING`,
      [email, passwordHash]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();

    if (email === undefined || email.length === 0) {
      return;
    }

    await queryRunner.query(
      `DELETE FROM "users" WHERE LOWER("email") = LOWER($1) AND "role" = 'ADMIN'`,
      [email]
    );
  }
}

function validateAdminBootstrapInput(email: string, password: string): void {
  if (email.length > MAX_ADMIN_BOOTSTRAP_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new Error(
      "[migration:SeedAdminUser] ADMIN_BOOTSTRAP_EMAIL must be a valid email address."
    );
  }

  if (
    password.length < MIN_ADMIN_BOOTSTRAP_PASSWORD_LENGTH ||
    password.length > MAX_ADMIN_BOOTSTRAP_PASSWORD_LENGTH
  ) {
    throw new Error(
      "[migration:SeedAdminUser] ADMIN_BOOTSTRAP_PASSWORD must be between " +
        `${MIN_ADMIN_BOOTSTRAP_PASSWORD_LENGTH} and ${MAX_ADMIN_BOOTSTRAP_PASSWORD_LENGTH} characters.`
    );
  }
}
