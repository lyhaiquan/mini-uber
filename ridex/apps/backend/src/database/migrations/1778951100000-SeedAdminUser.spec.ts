import { hash as argon2Hash } from "@node-rs/argon2";
import type { QueryRunner } from "typeorm";

import { SeedAdminUser1778951100000 } from "./1778951100000-SeedAdminUser";

jest.mock("@node-rs/argon2", () => ({
  hash: jest.fn().mockResolvedValue("hashed-admin-password")
}));

const ORIGINAL_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL;
const ORIGINAL_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD;

describe("SeedAdminUser1778951100000", () => {
  let queryRunner: jest.Mocked<Pick<QueryRunner, "query">>;

  beforeEach(() => {
    queryRunner = {
      query: jest.fn().mockResolvedValue([])
    };
    jest.clearAllMocks();
    delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
  });

  afterEach(() => {
    restoreEnv("ADMIN_BOOTSTRAP_EMAIL", ORIGINAL_EMAIL);
    restoreEnv("ADMIN_BOOTSTRAP_PASSWORD", ORIGINAL_PASSWORD);
    jest.restoreAllMocks();
  });

  it("inserts an admin user when bootstrap env vars are valid", async () => {
    process.env.ADMIN_BOOTSTRAP_EMAIL = "admin@ridex.local";
    process.env.ADMIN_BOOTSTRAP_PASSWORD = "very-strong-admin-pw-2026";

    await new SeedAdminUser1778951100000().up(queryRunner as unknown as QueryRunner);

    expect(argon2Hash).toHaveBeenCalledWith("very-strong-admin-pw-2026", {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(`INSERT INTO "users"`),
      ["admin@ridex.local", "hashed-admin-password"]
    );
  });

  it("throws when ADMIN_BOOTSTRAP_PASSWORD is too short", async () => {
    process.env.ADMIN_BOOTSTRAP_EMAIL = "admin@ridex.local";
    process.env.ADMIN_BOOTSTRAP_PASSWORD = "short";

    await expect(
      new SeedAdminUser1778951100000().up(queryRunner as unknown as QueryRunner)
    ).rejects.toThrow(/ADMIN_BOOTSTRAP_PASSWORD must be between 12 and 128 characters/);
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it("throws when ADMIN_BOOTSTRAP_EMAIL is malformed", async () => {
    process.env.ADMIN_BOOTSTRAP_EMAIL = "not-an-email";
    process.env.ADMIN_BOOTSTRAP_PASSWORD = "very-strong-admin-pw-2026";

    await expect(
      new SeedAdminUser1778951100000().up(queryRunner as unknown as QueryRunner)
    ).rejects.toThrow(/ADMIN_BOOTSTRAP_EMAIL must be a valid email address/);
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it("warns and skips when bootstrap env vars are absent", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    await new SeedAdminUser1778951100000().up(queryRunner as unknown as QueryRunner);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("ADMIN_BOOTSTRAP_EMAIL or ADMIN_BOOTSTRAP_PASSWORD not set")
    );
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it("deletes the seeded admin user on down when email is set", async () => {
    process.env.ADMIN_BOOTSTRAP_EMAIL = "admin@ridex.local";

    await new SeedAdminUser1778951100000().down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(`DELETE FROM "users"`),
      ["admin@ridex.local"]
    );
  });
});

function restoreEnv(key: "ADMIN_BOOTSTRAP_EMAIL" | "ADMIN_BOOTSTRAP_PASSWORD", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
