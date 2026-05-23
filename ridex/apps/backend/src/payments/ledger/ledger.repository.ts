import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { LedgerEntry } from "../entities/ledger-entry.entity";
import type { LedgerEntryDraft } from "../payments.types";

@Injectable()
export class LedgerRepository {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly repository: Repository<LedgerEntry>
  ) {}

  async appendEntries(entries: LedgerEntryDraft[], manager: EntityManager): Promise<LedgerEntry[]> {
    if (entries.length === 0) {
      return [];
    }

    const repository = manager.getRepository(LedgerEntry);
    return repository.save(entries.map((entry) => repository.create(entry)));
  }

  async findByPaymentId(paymentId: string): Promise<LedgerEntry[]> {
    return this.repository.find({ where: { paymentId } });
  }
}
