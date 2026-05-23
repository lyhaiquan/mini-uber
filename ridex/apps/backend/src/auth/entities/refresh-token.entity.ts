import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "refresh_tokens" })
export class RefreshToken {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Index("refresh_tokens_user_idx")
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Index("refresh_tokens_family_idx")
  @Column({ name: "family_id", type: "uuid" })
  familyId!: string;

  @Column({ name: "token_hash", type: "varchar", length: 128 })
  tokenHash!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;

  @Column({ name: "revoked_reason", type: "varchar", length: 64, nullable: true })
  revokedReason!: string | null;

  @Column({ name: "replaced_by_id", type: "uuid", nullable: true })
  replacedById!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
