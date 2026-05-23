import type { EntityManager, Repository } from "typeorm";

import type { LedgerEntry } from "../entities/ledger-entry.entity";
import { LedgerEntryType } from "../enums/ledger-entry-type.enum";
import { LedgerRepository } from "./ledger.repository";

describe("LedgerRepository", () => {
  it("appendEntries inserts all ledger drafts", async () => {
    const { repository } = createRepository();
    const managerRepo = {
      create: jest.fn((value: Partial<LedgerEntry>) => value as LedgerEntry),
      save: jest.fn(async (values: LedgerEntry[]) => values)
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo)
    } as unknown as EntityManager;

    await repository.appendEntries(
      [
        {
          paymentId: "payment-1",
          walletId: "wallet-1",
          entryType: LedgerEntryType.DEBIT,
          amountVnd: 100,
          balanceAfterVnd: 900,
          memo: "Ride payment"
        },
        {
          paymentId: "payment-1",
          walletId: "wallet-2",
          entryType: LedgerEntryType.CREDIT,
          amountVnd: 100,
          balanceAfterVnd: 100,
          memo: "Ride earning"
        }
      ],
      manager
    );

    expect(managerRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ entryType: LedgerEntryType.DEBIT }),
      expect.objectContaining({ entryType: LedgerEntryType.CREDIT })
    ]);
  });

  it("appendEntries no-ops on empty input", async () => {
    const { repository } = createRepository();
    const manager = {
      getRepository: jest.fn()
    } as unknown as EntityManager;

    await expect(repository.appendEntries([], manager)).resolves.toEqual([]);
    expect(manager.getRepository).not.toHaveBeenCalled();
  });

  it("exposes no update or delete methods", () => {
    const { repository } = createRepository();

    expect("update" in repository).toBe(false);
    expect("delete" in repository).toBe(false);
  });

  it("findByPaymentId reads ledger entries for a payment", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.find.mockResolvedValue([]);

    await repository.findByPaymentId("payment-1");

    expect(typeormRepository.find).toHaveBeenCalledWith({ where: { paymentId: "payment-1" } });
  });
});

function createRepository(): {
  repository: LedgerRepository;
  typeormRepository: jest.Mocked<Repository<LedgerEntry>>;
} {
  const typeormRepository = {
    find: jest.fn()
  } as unknown as jest.Mocked<Repository<LedgerEntry>>;
  return {
    repository: new LedgerRepository(typeormRepository),
    typeormRepository
  };
}
