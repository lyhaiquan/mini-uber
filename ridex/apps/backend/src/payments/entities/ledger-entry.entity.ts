import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

import { LedgerEntryType } from "../enums/ledger-entry-type.enum";

const bigintTransformer = {
  to: (value: number): number => value,
  from: (value: string | number | null): number => {
    if (value === null) {
      throw new Error("ledger bigint column returned null");
    }
    return typeof value === "number" ? value : Number(value);
  }
};

@Entity({ name: "ledger_entries" })
export class LedgerEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "payment_id", type: "uuid" })
  paymentId!: string;

  @Column({ name: "wallet_id", type: "uuid" })
  walletId!: string;

  @Column({ name: "entry_type", type: "text" })
  entryType!: LedgerEntryType;

  @Column({ name: "amount_vnd", type: "bigint", transformer: bigintTransformer })
  amountVnd!: number;

  @Column({ name: "balance_after_vnd", type: "bigint", transformer: bigintTransformer })
  balanceAfterVnd!: number;

  @Column({ type: "text" })
  memo!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
