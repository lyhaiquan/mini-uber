import { Injectable } from "@nestjs/common";

import type { Role } from "./dto/role.enum";
import type { UserAuthDto } from "./dto/user-auth.dto";
import type { UserSummaryDto } from "./dto/user-summary.dto";
import type { User } from "./entities/user.entity";
import { UsersService, type CreateUserInput } from "./users.service";

@Injectable()
export class UsersFacade {
  constructor(private readonly usersService: UsersService) {}

  // --- Public read-only API (used by future ride/payment/admin modules) -----

  async getUserById(id: string): Promise<UserSummaryDto | null> {
    const user = await this.usersService.findById(id);
    return user === null ? null : UsersFacade.toSummary(user);
  }

  async existsWithRole(id: string, role: Role): Promise<boolean> {
    const user = await this.usersService.findById(id);
    return user !== null && user.role === role;
  }

  // --- Auth-identity API (used by AuthService) ------------------------------

  async findAuthByEmail(email: string): Promise<UserAuthDto | null> {
    const user = await this.usersService.findByEmail(email);
    return user === null ? null : UsersFacade.toAuthDto(user);
  }

  async findAuthById(id: string): Promise<UserAuthDto | null> {
    const user = await this.usersService.findById(id);
    return user === null ? null : UsersFacade.toAuthDto(user);
  }

  async createUser(input: CreateUserInput): Promise<UserAuthDto> {
    const user = await this.usersService.create(input);
    return UsersFacade.toAuthDto(user);
  }

  async recordFailedLogin(userId: string): Promise<void> {
    await this.usersService.recordFailedLogin(userId);
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await this.usersService.resetFailedLogins(userId);
  }

  // --- Internal conversion helpers ------------------------------------------

  static toSummary(user: User): UserSummaryDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString()
    };
  }

  static toAuthDto(user: User): UserAuthDto {
    const now = new Date();
    const isLocked = user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime();

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      isLocked,
      lockedUntil: user.lockedUntil === null ? null : user.lockedUntil.toISOString()
    };
  }
}
