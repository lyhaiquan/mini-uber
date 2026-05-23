import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn
} from "typeorm";

import { WalletKind } from "../enums/wallet-kind.enum";

const bigintTransformer = {
  to: (value: number): number => value,
  from: (value: string | number | null): number => {
    if (value === null) {
      throw new Error("wallet bigint column returned null");
    }
    return typeof value === "number" ? value : Number(value);
  }
};

@Entity({ name: "wallets" })
export class Wallet {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "text" })
  kind!: WalletKind;

  @Column({ type: "text", default: "VND" })
  currency!: string;

  @Column({ name: "balance_vnd", type: "bigint", transformer: bigintTransformer, default: 0 })
  balanceVnd!: number;

  @VersionColumn({ type: "int", default: 0 })
  version!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
