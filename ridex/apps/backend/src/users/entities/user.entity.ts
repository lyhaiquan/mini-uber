import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import { Role } from "../dto/role.enum";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("users_email_idx")
  @Column({ type: "varchar", length: 254 })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "varchar", length: 32, default: Role.CUSTOMER })
  role!: Role;

  @Column({ name: "failed_login_count", type: "int", default: 0 })
  failedLoginCount!: number;

  @Column({ name: "first_failed_login_at", type: "timestamptz", nullable: true })
  firstFailedLoginAt!: Date | null;

  @Column({ name: "locked_until", type: "timestamptz", nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
