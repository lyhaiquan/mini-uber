import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import type { EnvironmentVariables } from "../config/env.validation";
import { Role } from "./dto/role.enum";
import { User } from "./entities/user.entity";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role?: Role;
}

@Injectable()
export class UsersService {
  private readonly maxAttempts: number;
  private readonly attemptsWindowMs: number;
  private readonly lockoutDurationMs: number;

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.maxAttempts = configService.get("AUTH_LOCKOUT_MAX_ATTEMPTS", { infer: true });
    this.attemptsWindowMs = configService.get("AUTH_LOCKOUT_WINDOW_MS", { infer: true });
    this.lockoutDurationMs = configService.get("AUTH_LOCKOUT_DURATION_MS", { infer: true });
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return this.userRepository
      .createQueryBuilder("user")
      .where("LOWER(user.email) = :email", { email: normalized })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async create(input: CreateUserInput): Promise<User> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.findByEmail(normalizedEmail);

    if (existing !== null) {
      throw new ConflictException({
        code: "USER_ALREADY_EXISTS",
        message: "An account with this email already exists."
      });
    }

    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      role: input.role ?? Role.CUSTOMER,
      failedLoginCount: 0,
      firstFailedLoginAt: null,
      lockedUntil: null
    });

    try {
      return await this.userRepository.save(user);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: "USER_ALREADY_EXISTS",
          message: "An account with this email already exists."
        });
      }

      throw error;
    }
  }

  isLocked(user: User, now: Date = new Date()): boolean {
    return user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime();
  }

  async recordFailedLogin(userId: string, now: Date = new Date()): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (user === null) {
      return;
    }

    const isWithinWindow =
      user.firstFailedLoginAt !== null &&
      now.getTime() - user.firstFailedLoginAt.getTime() <= this.attemptsWindowMs;

    const nextCount = isWithinWindow ? user.failedLoginCount + 1 : 1;
    const firstFailedAt = isWithinWindow ? user.firstFailedLoginAt : now;
    const reachedThreshold = nextCount >= this.maxAttempts;
    const lockedUntil = reachedThreshold ? new Date(now.getTime() + this.lockoutDurationMs) : null;

    await this.userRepository.update(userId, {
      failedLoginCount: reachedThreshold ? 0 : nextCount,
      firstFailedLoginAt: reachedThreshold ? null : firstFailedAt,
      lockedUntil: lockedUntil ?? user.lockedUntil
    });
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      failedLoginCount: 0,
      firstFailedLoginAt: null,
      lockedUntil: null
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as { code?: unknown; driverError?: { code?: unknown } };
  return maybeError.code === "23505" || maybeError.driverError?.code === "23505";
}
