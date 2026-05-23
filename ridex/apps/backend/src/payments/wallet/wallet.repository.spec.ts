import type { EntityManager, Repository } from "typeorm";

import { Wallet } from "../entities/wallet.entity";
import { WalletKind } from "../enums/wallet-kind.enum";
import { WalletNotFoundError } from "../errors/payment-errors";
import { WalletRepository } from "./wallet.repository";

describe("WalletRepository", () => {
  it("findOrCreateForUser returns existing wallet", async () => {
    const { repository, typeormRepository } = createRepository();
    const existing = wallet({ id: "wallet-1" });
    typeormRepository.findOne.mockResolvedValue(existing);

    await expect(
      repository.findOrCreateForUser("user-1", WalletKind.CUSTOMER, 500_000)
    ).resolves.toBe(existing);
    expect(typeormRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("findOrCreateForUser creates a seeded wallet when missing", async () => {
    const { repository, typeormRepository, queryBuilder } = createRepository();
    const created = wallet({ id: "wallet-created", balanceVnd: 500_000 });
    typeormRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(created);

    const result = await repository.findOrCreateForUser(
      "user-1",
      WalletKind.CUSTOMER,
      500_000
    );

    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", kind: WalletKind.CUSTOMER, balanceVnd: 500_000 })
    );
    expect(result.balanceVnd).toBe(500_000);
  });

  it("findOrCreateForUser handles replay after concurrent upsert no-op", async () => {
    const { repository, typeormRepository, queryBuilder } = createRepository();
    const createdByReplay = wallet({ id: "wallet-after" });
    typeormRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(createdByReplay);

    await expect(
      repository.findOrCreateForUser("user-1", WalletKind.CUSTOMER, 500_000)
    ).resolves.toBe(createdByReplay);
    expect(queryBuilder.orIgnore).toHaveBeenCalled();
  });

  it("findOrCreateForUser throws if the upsert does not leave a wallet row", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.findOne.mockResolvedValue(null);

    await expect(
      repository.findOrCreateForUser("user-1", WalletKind.CUSTOMER, 500_000)
    ).rejects.toThrow(WalletNotFoundError);
  });

  it("findPlatform returns platform wallet", async () => {
    const { repository, typeormRepository } = createRepository();
    const platform = wallet({ kind: WalletKind.PLATFORM, userId: null });
    typeormRepository.findOne.mockResolvedValue(platform);

    await expect(repository.findPlatform()).resolves.toBe(platform);
  });

  it("findPlatform throws when singleton platform wallet is missing", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.findOne.mockResolvedValue(null);

    await expect(repository.findPlatform()).rejects.toThrow(WalletNotFoundError);
  });

  it("locks payment wallets by id ascending", async () => {
    const { repository } = createRepository();
    const customer = wallet({ id: "c-wallet", userId: "customer" });
    const driver = wallet({ id: "a-wallet", userId: "driver", kind: WalletKind.DRIVER });
    const platform = wallet({ id: "b-wallet", userId: null, kind: WalletKind.PLATFORM });
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest
          .fn()
          .mockResolvedValueOnce(customer)
          .mockResolvedValueOnce(driver)
          .mockResolvedValueOnce(platform)
      }),
      find: jest.fn().mockResolvedValue([driver, platform, customer])
    } as unknown as jest.Mocked<EntityManager>;

    const result = await repository.lockWalletsForPayment("customer", "driver", 500_000, manager);

    expect(result.lockOrderIds).toEqual(["a-wallet", "b-wallet", "c-wallet"]);
    expect(manager.find).toHaveBeenCalledWith(
      Wallet,
      expect.objectContaining({
        lock: { mode: "pessimistic_write" },
        order: { id: "ASC" }
      })
    );
  });

  it("saveAll persists wallet balance changes", async () => {
    const { repository } = createRepository();
    const manager = {
      save: jest.fn().mockResolvedValue([])
    } as unknown as jest.Mocked<EntityManager>;

    await repository.saveAll([wallet({ id: "wallet-1" })], manager);

    expect(manager.save).toHaveBeenCalledWith(Wallet, [expect.objectContaining({ id: "wallet-1" })]);
  });
});

function createRepository(): {
  repository: WalletRepository;
  typeormRepository: jest.Mocked<Repository<Wallet>>;
  queryBuilder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };
} {
  const queryBuilder = {
    insert: jest.fn(),
    into: jest.fn(),
    values: jest.fn(),
    orIgnore: jest.fn(),
    execute: jest.fn().mockResolvedValue({})
  };
  queryBuilder.insert.mockReturnValue(queryBuilder);
  queryBuilder.into.mockReturnValue(queryBuilder);
  queryBuilder.values.mockReturnValue(queryBuilder);
  queryBuilder.orIgnore.mockReturnValue(queryBuilder);
  const typeormRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
  } as unknown as jest.Mocked<Repository<Wallet>>;
  return {
    repository: new WalletRepository(typeormRepository),
    typeormRepository,
    queryBuilder
  };
}

function wallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    id: "wallet",
    userId: "user",
    kind: WalletKind.CUSTOMER,
    currency: "VND",
    balanceVnd: 100_000,
    version: 0,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    updatedAt: new Date("2026-05-17T00:00:00.000Z"),
    ...overrides
  };
}
