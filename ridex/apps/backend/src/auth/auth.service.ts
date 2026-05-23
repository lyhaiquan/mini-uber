import { randomUUID } from "node:crypto";

import {
  ConflictException,
  Injectable,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { IsNull, Not, Repository } from "typeorm";

import { CryptoService } from "../common/crypto/crypto.service";
import type { DomainEvent } from "../common/domain-event";
import { AUTH_USER_CREATED_EVENT } from "../common/events/event-types";
import { StructuredLogger } from "../common/logging/structured-logger";
import type { EnvironmentVariables } from "../config/env.validation";
import type { UserAuthDto } from "../users/dto/user-auth.dto";
import { UsersFacade } from "../users/users.facade";
import type { AuthTokensResponse } from "./dto/auth-response.dto";
import type { LoginDto } from "./dto/login.dto";
import type { LogoutDto } from "./dto/logout.dto";
import type { RefreshDto } from "./dto/refresh.dto";
import type { RegisterDto } from "./dto/register.dto";
import { RefreshToken } from "./entities/refresh-token.entity";

const CONTEXT = "AuthService";

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly usersFacade: UsersFacade,
    private readonly jwtService: JwtService,
    private readonly cryptoService: CryptoService,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>,
    @Optional() private readonly eventEmitter?: EventEmitter2
  ) {
    this.accessSecret = configService.get("JWT_ACCESS_SECRET", { infer: true });
    this.refreshSecret = configService.get("JWT_REFRESH_SECRET", { infer: true });
    this.accessTtl = configService.get("JWT_ACCESS_TTL", { infer: true });
    this.refreshTtl = configService.get("JWT_REFRESH_TTL", { infer: true });
    this.accessTtlSeconds = parseTtlToSeconds(this.accessTtl);
    this.refreshTtlMs = parseTtlToSeconds(this.refreshTtl) * 1000;
  }

  async register(dto: RegisterDto): Promise<AuthTokensResponse> {
    let user: UserAuthDto;

    try {
      const passwordHash = await this.hashPassword(dto.password);
      user = await this.usersFacade.createUser({
        email: dto.email,
        passwordHash
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn(
          { event: "auth.register.duplicate", email: maskEmail(dto.email) },
          CONTEXT
        );
        throw error;
      }
      throw error;
    }

    this.logger.log(
      { event: "auth.register.success", userId: user.id, role: user.role },
      CONTEXT
    );
    this.emitUserCreated(user);

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.usersFacade.findAuthByEmail(dto.email);

    if (user === null) {
      this.logger.warn(
        { event: "auth.login.failed", reason: "unknown_user", email: maskEmail(dto.email) },
        CONTEXT
      );
      throw this.invalidCredentialsError();
    }

    if (user.isLocked) {
      this.logger.warn(
        { event: "auth.login.locked", userId: user.id, lockedUntil: user.lockedUntil },
        CONTEXT
      );
      throw new UnauthorizedException({
        code: "ACCOUNT_LOCKED",
        message: "Account is temporarily locked due to repeated failed login attempts."
      });
    }

    const valid = await argon2Verify(user.passwordHash, dto.password);

    if (!valid) {
      await this.usersFacade.recordFailedLogin(user.id);
      this.logger.warn(
        { event: "auth.login.failed", userId: user.id, reason: "bad_password" },
        CONTEXT
      );
      throw this.invalidCredentialsError();
    }

    await this.usersFacade.resetFailedLogins(user.id);
    this.logger.log({ event: "auth.login.success", userId: user.id }, CONTEXT);

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthTokensResponse> {
    const parsed = this.cryptoService.parseRefreshToken(dto.refreshToken);

    if (parsed === undefined) {
      throw this.invalidRefreshTokenError();
    }

    return this.refreshTokenRepo.manager.transaction(async (manager) => {
      const refreshTokenRepo = manager.getRepository(RefreshToken);
      const stored = await refreshTokenRepo.findOne({
        where: { id: parsed.tokenId },
        lock: { mode: "pessimistic_write" }
      });

      if (stored === null) {
        throw this.invalidRefreshTokenError();
      }

      const expectedHash = this.cryptoService.hashRefreshSecret(parsed.secret);

      if (!this.cryptoService.constantTimeEquals(stored.tokenHash, expectedHash)) {
        throw this.invalidRefreshTokenError();
      }

      if (stored.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException({
          code: "REFRESH_TOKEN_EXPIRED",
          message: "Refresh token has expired."
        });
      }

      if (stored.revokedAt !== null) {
        // Reuse detection is scoped to the token family, which maps to one login
        // session/device. Future security-admin flows can add global session
        // invalidation by userId when that policy is needed.
        await this.invalidateFamily(refreshTokenRepo, stored.familyId, "reuse_detected");
        this.logger.warn(
          {
            event: "auth.refresh.reuse_detected",
            userId: stored.userId,
            familyId: stored.familyId,
            tokenId: stored.id
          },
          CONTEXT
        );
        throw new UnauthorizedException({
          code: "REFRESH_TOKEN_REUSED",
          message: "Refresh token reuse detected. All sessions invalidated."
        });
      }

      const user = await this.usersFacade.findAuthById(stored.userId);

      if (user === null) {
        throw this.invalidRefreshTokenError();
      }

      const issued = await this.issueAndPersistTokens(user, stored.familyId, refreshTokenRepo);

      await refreshTokenRepo.update(stored.id, {
        revokedAt: new Date(),
        revokedReason: "rotated",
        replacedById: issued.newTokenId
      });

      this.logger.log(
        { event: "auth.refresh.success", userId: user.id, familyId: stored.familyId },
        CONTEXT
      );

      return issued.response;
    });
  }

  async logout(dto: LogoutDto): Promise<void> {
    const parsed = this.cryptoService.parseRefreshToken(dto.refreshToken);

    if (parsed === undefined) {
      return;
    }

    const stored = await this.refreshTokenRepo.findOne({ where: { id: parsed.tokenId } });

    if (stored === null) {
      return;
    }

    const expectedHash = this.cryptoService.hashRefreshSecret(parsed.secret);

    if (!this.cryptoService.constantTimeEquals(stored.tokenHash, expectedHash)) {
      return;
    }

    if (stored.revokedAt !== null) {
      return;
    }

    await this.refreshTokenRepo.update(stored.id, {
      revokedAt: new Date(),
      revokedReason: "logout"
    });

    this.logger.log(
      { event: "auth.logout.success", userId: stored.userId, tokenId: stored.id },
      CONTEXT
    );
  }

  private async issueTokens(user: UserAuthDto): Promise<AuthTokensResponse> {
    const { response } = await this.issueAndPersistTokens(user);
    return response;
  }

  private async issueAndPersistTokens(
    user: UserAuthDto,
    familyId?: string,
    refreshTokenRepo: Repository<RefreshToken> = this.refreshTokenRepo
  ): Promise<{ response: AuthTokensResponse; newTokenId: string }> {
    const generated = this.cryptoService.generateRefreshToken();
    const finalFamilyId = familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    await refreshTokenRepo.save({
      id: generated.tokenId,
      userId: user.id,
      familyId: finalFamilyId,
      tokenHash: this.cryptoService.hashRefreshSecret(generated.secret),
      expiresAt,
      revokedAt: null,
      revokedReason: null,
      replacedById: null
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      { secret: this.accessSecret, expiresIn: this.accessTtl }
    );

    return {
      response: {
        accessToken,
        refreshToken: generated.token,
        accessTokenExpiresInSeconds: this.accessTtlSeconds,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      },
      newTokenId: generated.tokenId
    };
  }

  private async invalidateFamily(
    refreshTokenRepo: Repository<RefreshToken>,
    familyId: string,
    reason: string
  ): Promise<void> {
    await refreshTokenRepo.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason }
    );

    // Ensure the originally-reused token is also marked (it already was revoked,
    // but we add the family-wide reason via separate update for any siblings).
    await refreshTokenRepo.update(
      { familyId, revokedAt: Not(IsNull()), revokedReason: IsNull() },
      { revokedReason: reason }
    );
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2Hash(password, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
  }

  private emitUserCreated(user: UserAuthDto): void {
    if (this.eventEmitter === undefined) {
      return;
    }

    const event: DomainEvent<{ userId: string; role: UserAuthDto["role"] }> = {
      eventId: randomUUID(),
      eventType: AUTH_USER_CREATED_EVENT,
      aggregateType: "user",
      aggregateId: user.id,
      payload: {
        userId: user.id,
        role: user.role
      },
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      emittedBy: "auth"
    };

    try {
      this.eventEmitter.emit(AUTH_USER_CREATED_EVENT, event);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "auth.user_created.emit_failed",
          userId: user.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }
  }

  private invalidCredentialsError(): UnauthorizedException {
    return new UnauthorizedException({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password."
    });
  }

  private invalidRefreshTokenError(): UnauthorizedException {
    return new UnauthorizedException({
      code: "INVALID_REFRESH_TOKEN",
      message: "Refresh token is invalid."
    });
  }
}

function parseTtlToSeconds(ttl: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(ttl);

  if (match === null) {
    throw new Error(`Invalid TTL value: ${ttl}`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return Math.floor(value / 1000);
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Unsupported TTL unit: ${unit}`);
  }
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");

  if (atIndex <= 0) {
    return "***";
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  const visible = local.slice(0, Math.min(2, local.length));

  return `${visible}***${domain}`;
}
