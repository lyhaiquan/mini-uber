import type { ConfigService } from "@nestjs/config";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { Role } from "../../users/dto/role.enum";
import { WalletKind } from "../enums/wallet-kind.enum";
import type { WalletRepository } from "../wallet/wallet.repository";
import {
  UserCreatedWalletSeeder,
  type AuthUserCreatedEvent
} from "./user-created.wallet-seeder";

describe("UserCreatedWalletSeeder", () => {
  it("seeds customer wallets for customer users", async () => {
    const { seeder, walletRepository } = createSeeder();

    await seeder.handle(event(Role.CUSTOMER));

    expect(walletRepository.findOrCreateForUser).toHaveBeenCalledWith(
      "user-1",
      WalletKind.CUSTOMER,
      500_000
    );
  });

  it("seeds driver wallets for driver users", async () => {
    const { seeder, walletRepository } = createSeeder();

    await seeder.handle(event(Role.DRIVER));

    expect(walletRepository.findOrCreateForUser).toHaveBeenCalledWith(
      "user-1",
      WalletKind.DRIVER,
      500_000
    );
  });

  it("treats replay as idempotent by delegating to findOrCreate", async () => {
    const { seeder, walletRepository } = createSeeder();

    await seeder.handle(event(Role.CUSTOMER));
    await seeder.handle(event(Role.CUSTOMER));

    expect(walletRepository.findOrCreateForUser).toHaveBeenCalledTimes(2);
  });

  it("logs and swallows wallet seed failures", async () => {
    const { seeder, walletRepository, logger } = createSeeder();
    walletRepository.findOrCreateForUser.mockRejectedValue(new Error("db down"));

    await expect(seeder.handle(event(Role.CUSTOMER))).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "payment.wallet_seed.failed" }),
      expect.any(String),
      "UserCreatedWalletSeeder"
    );
  });
});

function createSeeder(): {
  seeder: UserCreatedWalletSeeder;
  walletRepository: jest.Mocked<WalletRepository>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const walletRepository = {
    findOrCreateForUser: jest.fn()
  } as unknown as jest.Mocked<WalletRepository>;
  const logger = {
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn().mockReturnValue(500_000)
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return {
    seeder: new UserCreatedWalletSeeder(walletRepository, logger, configService),
    walletRepository,
    logger
  };
}

function event(role: Role): AuthUserCreatedEvent {
  return {
    eventId: "event-1",
    eventType: "auth.user.created",
    aggregateType: "user",
    aggregateId: "user-1",
    payload: { userId: "user-1", role },
    correlationId: "corr-1",
    occurredAt: "2026-05-17T00:00:00.000Z",
    emittedBy: "auth"
  };
}
