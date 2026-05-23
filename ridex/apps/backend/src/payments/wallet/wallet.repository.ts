import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, IsNull, Repository } from "typeorm";

import { Wallet } from "../entities/wallet.entity";
import { WalletKind } from "../enums/wallet-kind.enum";
import { WalletNotFoundError } from "../errors/payment-errors";
import type { LockedWallets } from "../payments.types";

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(Wallet)
    private readonly repository: Repository<Wallet>
  ) {}

  async findOrCreateForUser(
    userId: string,
    kind: WalletKind,
    initialBalanceVnd: number,
    manager?: EntityManager
  ): Promise<Wallet> {
    const repository = this.getRepository(manager);
    const existing = await repository.findOne({ where: { userId, kind } });
    if (existing !== null) {
      return existing;
    }

    await repository
      .createQueryBuilder()
      .insert()
      .into(Wallet)
      .values({
        userId,
        kind,
        currency: "VND",
        balanceVnd: initialBalanceVnd,
        version: 0
      })
      .orIgnore()
      .execute();

    const created = await repository.findOne({ where: { userId, kind } });
    if (created === null) {
      throw new WalletNotFoundError(`Wallet was not found after upsert: ${userId}/${kind}`);
    }
    return created;
  }

  async findPlatform(manager?: EntityManager): Promise<Wallet> {
    const wallet = await this.getRepository(manager).findOne({
      where: { kind: WalletKind.PLATFORM, userId: IsNull() }
    });
    if (wallet === null) {
      throw new WalletNotFoundError("Platform wallet not found.");
    }
    return wallet;
  }

  async getWalletForUser(userId: string, kind: WalletKind): Promise<Wallet | null> {
    return this.repository.findOne({ where: { userId, kind } });
  }

  async lockWalletsForPayment(
    customerUserId: string,
    driverUserId: string,
    customerInitialBalanceVnd: number,
    manager: EntityManager
  ): Promise<LockedWallets> {
    const customerWallet = await this.findOrCreateForUser(
      customerUserId,
      WalletKind.CUSTOMER,
      customerInitialBalanceVnd,
      manager
    );
    const driverWallet = await this.findOrCreateForUser(
      driverUserId,
      WalletKind.DRIVER,
      0,
      manager
    );
    const platformWallet = await this.findPlatform(manager);

    const ids = [customerWallet.id, driverWallet.id, platformWallet.id].sort();
    const locked = await manager.find(Wallet, {
      where: { id: In(ids) },
      lock: { mode: "pessimistic_write" },
      order: { id: "ASC" }
    });
    const byId = new Map(locked.map((wallet) => [wallet.id, wallet]));

    return {
      customerWallet: requiredWallet(byId, customerWallet.id),
      driverWallet: requiredWallet(byId, driverWallet.id),
      platformWallet: requiredWallet(byId, platformWallet.id),
      lockOrderIds: ids
    };
  }

  async saveAll(wallets: Wallet[], manager: EntityManager): Promise<Wallet[]> {
    return manager.save(Wallet, wallets);
  }

  private getRepository(manager?: EntityManager): Repository<Wallet> {
    return manager?.getRepository(Wallet) ?? this.repository;
  }
}

function requiredWallet(wallets: Map<string, Wallet>, id: string): Wallet {
  const wallet = wallets.get(id);
  if (wallet === undefined) {
    throw new WalletNotFoundError(`Wallet disappeared while locking: ${id}`);
  }
  return wallet;
}
