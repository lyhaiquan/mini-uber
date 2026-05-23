import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Repository, SelectQueryBuilder } from "typeorm";

import type { EnvironmentVariables } from "../config/env.validation";
import { Role } from "./dto/role.enum";
import type { User } from "./entities/user.entity";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const lockoutConfig = {
    AUTH_LOCKOUT_MAX_ATTEMPTS: 3,
    AUTH_LOCKOUT_WINDOW_MS: 900_000,
    AUTH_LOCKOUT_DURATION_MS: 900_000
  };

  function createMocks(): {
    repo: jest.Mocked<Repository<User>>;
    qb: jest.Mocked<SelectQueryBuilder<User>>;
    service: UsersService;
  } {
    const qb = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn()
    } as unknown as jest.Mocked<SelectQueryBuilder<User>>;

    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      create: jest.fn((data: Partial<User>) => data as User),
      save: jest.fn((entity: User) => Promise.resolve({ ...entity, id: "user-id-1" })),
      update: jest.fn().mockResolvedValue({ affected: 1 })
    } as unknown as jest.Mocked<Repository<User>>;

    const configService = {
      get: jest.fn((key: keyof EnvironmentVariables) => {
        return (lockoutConfig as Record<string, unknown>)[key];
      })
    } as unknown as ConfigService<EnvironmentVariables, true>;

    const service = new UsersService(repo, configService);
    return { repo, qb, service };
  }

  it("creates a user with normalized email and default role", async () => {
    const { repo, qb, service } = createMocks();
    qb.getOne.mockResolvedValue(null);

    const user = await service.create({
      email: "  Bob@Example.COM  ",
      passwordHash: "hash"
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "bob@example.com",
        passwordHash: "hash",
        role: Role.CUSTOMER,
        failedLoginCount: 0
      })
    );
    expect(repo.save).toHaveBeenCalled();
    expect(user.email).toBe("bob@example.com");
  });

  it("rejects duplicate registration", async () => {
    const { qb, service } = createMocks();
    qb.getOne.mockResolvedValue({ id: "existing" } as User);

    await expect(
      service.create({ email: "x@y.com", passwordHash: "h" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps database unique email races to ConflictException", async () => {
    const { repo, qb, service } = createMocks();
    qb.getOne.mockResolvedValue(null);
    repo.save.mockRejectedValueOnce({ code: "23505" });

    await expect(
      service.create({ email: "race@example.com", passwordHash: "h" })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "USER_ALREADY_EXISTS" })
    });
  });

  it("increments failed login within window", async () => {
    const { repo, service } = createMocks();
    const now = new Date("2026-05-15T10:00:00Z");
    const firstFailed = new Date(now.getTime() - 60_000);

    (repo.findOne as jest.Mock).mockResolvedValue({
      id: "u1",
      failedLoginCount: 1,
      firstFailedLoginAt: firstFailed,
      lockedUntil: null
    });

    await service.recordFailedLogin("u1", now);

    expect(repo.update).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        failedLoginCount: 2,
        firstFailedLoginAt: firstFailed
      })
    );
  });

  it("locks the account when reaching threshold", async () => {
    const { repo, service } = createMocks();
    const now = new Date("2026-05-15T10:00:00Z");
    const firstFailed = new Date(now.getTime() - 60_000);

    (repo.findOne as jest.Mock).mockResolvedValue({
      id: "u1",
      failedLoginCount: 2,
      firstFailedLoginAt: firstFailed,
      lockedUntil: null
    });

    await service.recordFailedLogin("u1", now);

    const updateCall = (repo.update as jest.Mock).mock.calls[0];
    expect(updateCall[0]).toBe("u1");
    expect(updateCall[1].failedLoginCount).toBe(0);
    expect(updateCall[1].firstFailedLoginAt).toBeNull();
    expect(updateCall[1].lockedUntil).toBeInstanceOf(Date);
    expect((updateCall[1].lockedUntil as Date).getTime()).toBe(now.getTime() + 900_000);
  });

  it("resets failed login counters on success", async () => {
    const { repo, service } = createMocks();
    await service.resetFailedLogins("u1");

    expect(repo.update).toHaveBeenCalledWith("u1", {
      failedLoginCount: 0,
      firstFailedLoginAt: null,
      lockedUntil: null
    });
  });

  it("isLocked checks lockedUntil against current time", () => {
    const { service } = createMocks();
    const now = new Date("2026-05-15T10:00:00Z");

    expect(
      service.isLocked({ lockedUntil: null } as User, now)
    ).toBe(false);
    expect(
      service.isLocked({ lockedUntil: new Date(now.getTime() + 1000) } as User, now)
    ).toBe(true);
    expect(
      service.isLocked({ lockedUntil: new Date(now.getTime() - 1000) } as User, now)
    ).toBe(false);
  });
});
