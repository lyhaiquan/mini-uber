import { ConflictException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { JwtService } from "@nestjs/jwt";
import { hash as argon2Hash } from "@node-rs/argon2";
import type { Repository } from "typeorm";

import { CryptoService } from "../common/crypto/crypto.service";
import { StructuredLogger } from "../common/logging/structured-logger";
import type { EnvironmentVariables } from "../config/env.validation";
import { Role } from "../users/dto/role.enum";
import type { UserAuthDto } from "../users/dto/user-auth.dto";
import type { UsersFacade } from "../users/users.facade";
import { AuthService } from "./auth.service";
import type { RefreshToken } from "./entities/refresh-token.entity";

const envConfig: EnvironmentVariables = {
  NODE_ENV: "test",
  PORT: 3000,
  API_PREFIX: "api/v1",
  APP_NAME: "RideX Backend",
  LOG_LEVEL: "error",
  CORS_ORIGINS: ["http://localhost:3001"],
  DATABASE_URL: "postgres://test/test",
  DATABASE_SSL: false,
  JWT_ACCESS_SECRET: "access-secret-32-chars-min-length-aaa",
  JWT_REFRESH_SECRET: "refresh-secret-32-chars-min-length-bb",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "7d",
  AUTH_LOCKOUT_MAX_ATTEMPTS: 5,
  AUTH_LOCKOUT_WINDOW_MS: 900_000,
  AUTH_LOCKOUT_DURATION_MS: 900_000,
  REDIS_URL: "redis://localhost:6379",
  DRIVER_LOCATION_TTL_SECONDS: 60,
  LOCATION_MAX_SPEED_MPS: 55,
  LOCATION_MAX_JUMP_METERS: 1000,
  LOCATION_JUMP_DETECTION_WINDOW_SECONDS: 30,
  WS_PATH: "/socket.io",
  H3_DISCOVERY_MAX_RING: 5,
  H3_STALE_SWEEP_INTERVAL_SECONDS: 30,
  OSRM_BASE_URL: "http://osrm:5000",
  OSRM_TIMEOUT_MS: 1500,
  ROUTING_FALLBACK_ROAD_FACTOR: 1.3,
  ROUTING_FALLBACK_CITY_SPEED_KMH: 30,
  ROUTING_ESTIMATE_CACHE_SIZE: 1024,
  ROUTING_ESTIMATE_CACHE_TTL_SECONDS: 60,
  MATCHING_MAX_CANDIDATES: 5,
  MATCHING_OFFER_TIMEOUT_SECONDS: 15,
  MATCHING_DISCOVERY_MAX_RING: 3,
  MATCHING_SCORE_DISTANCE_WEIGHT: 0.6,
  MATCHING_SCORE_ETA_WEIGHT: 0.4,
  PRICING_BASE_FARE_VND: 12000,
  PRICING_PER_KM_VND: 5000,
  PRICING_PER_MIN_VND: 500,
  PRICING_MINIMUM_FARE_VND: 15000,
  PRICING_SURGE_RATIO_THRESHOLD: 1.0,
  PRICING_SURGE_COEFFICIENT: 0.5,
  PRICING_SURGE_CAP: 3.0,
  PRICING_DEMAND_WINDOW_SECONDS: 300,
  PAYMENT_WALLET_SEED_VND: 500_000,
  PAYMENT_DRIVER_SHARE_BPS: 8000,
  PAYMENT_PLATFORM_SHARE_BPS: 2000,
  ADMIN_BOOTSTRAP_EMAIL: null,
  ADMIN_BOOTSTRAP_PASSWORD: null
};

function createService(): {
  service: AuthService;
  refreshRepo: jest.Mocked<Repository<RefreshToken>>;
  usersFacade: jest.Mocked<UsersFacade>;
  jwtService: jest.Mocked<JwtService>;
  cryptoService: CryptoService;
  refreshStore: Map<string, RefreshToken>;
  eventEmitter: jest.Mocked<EventEmitter2>;
} {
  const refreshStore = new Map<string, RefreshToken>();

  const refreshRepo = {
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => {
      return refreshStore.get(where.id) ?? null;
    }),
    save: jest.fn(async (entity: RefreshToken) => {
      const stored: RefreshToken = {
        ...entity,
        createdAt: new Date()
      } as RefreshToken;
      refreshStore.set(stored.id, stored);
      return stored;
    }),
    update: jest.fn(async (idOrWhere: string | Record<string, unknown>, partial: Partial<RefreshToken>) => {
      if (typeof idOrWhere === "string") {
        const existing = refreshStore.get(idOrWhere);
        if (existing !== undefined) {
          Object.assign(existing, partial);
        }
        return { affected: existing ? 1 : 0 };
      }

      const where = idOrWhere as { familyId?: string; revokedAt?: unknown };
      let count = 0;
      for (const token of refreshStore.values()) {
        if (where.familyId !== undefined && token.familyId !== where.familyId) {
          continue;
        }
        if (where.revokedAt !== undefined && token.revokedAt !== null) {
          continue;
        }
        Object.assign(token, partial);
        count += 1;
      }
      return { affected: count };
    })
  } as unknown as jest.Mocked<Repository<RefreshToken>>;
  const transactionManager = {
    getRepository: jest.fn().mockReturnValue(refreshRepo)
  };
  let transactionQueue: Promise<void> = Promise.resolve();
  Object.assign(refreshRepo, {
    manager: {
      transaction: jest.fn(<TResult>(callback: (manager: typeof transactionManager) => Promise<TResult>) => {
        const run = transactionQueue.then(() => callback(transactionManager));
        transactionQueue = run.then(
          () => undefined,
          () => undefined
        );
        return run;
      })
    }
  });

  const usersFacade = {
    createUser: jest.fn(),
    findAuthByEmail: jest.fn(),
    findAuthById: jest.fn(),
    recordFailedLogin: jest.fn().mockResolvedValue(undefined),
    resetFailedLogins: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<UsersFacade>;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue("signed.access.jwt"),
    verifyAsync: jest.fn()
  } as unknown as jest.Mocked<JwtService>;

  const cryptoService = new CryptoService();

  const logger = new StructuredLogger({
    get: jest.fn().mockReturnValue("error")
  } as unknown as ConfigService<EnvironmentVariables, true>);

  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => envConfig[key])
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;

  const service = new AuthService(
    refreshRepo,
    usersFacade,
    jwtService,
    cryptoService,
    logger,
    configService,
    eventEmitter
  );

  return { service, refreshRepo, usersFacade, jwtService, cryptoService, refreshStore, eventEmitter };
}

function makeUser(overrides: Partial<UserAuthDto> = {}): UserAuthDto {
  return {
    id: "user-1",
    email: "user@example.com",
    passwordHash: "set-in-test",
    role: Role.CUSTOMER,
    isLocked: false,
    lockedUntil: null,
    ...overrides
  };
}

describe("AuthService", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("register", () => {
    it("hashes the password and creates the user", async () => {
      const { service, usersFacade, refreshRepo } = createService();
      usersFacade.createUser.mockImplementation(async ({ email, passwordHash }) =>
        makeUser({ id: "new-id", email, passwordHash })
      );

      const result = await service.register({
        email: "new@example.com",
        password: "supersecret"
      });

      expect(usersFacade.createUser).toHaveBeenCalledTimes(1);
      const { passwordHash } = usersFacade.createUser.mock.calls[0][0];
      expect(passwordHash.startsWith("$argon2")).toBe(true);

      expect(result.accessToken).toBe("signed.access.jwt");
      expect(result.refreshToken).toMatch(/^[0-9a-f-]{36}\.[0-9a-f]{64}$/);
      expect(result.user).toEqual({
        id: "new-id",
        email: "new@example.com",
        role: Role.CUSTOMER
      });
      expect(refreshRepo.save).toHaveBeenCalledTimes(1);
    });

    it("emits auth.user.created after registration persists", async () => {
      const { service, usersFacade, eventEmitter } = createService();
      usersFacade.createUser.mockResolvedValue(
        makeUser({ id: "user-created-1", role: Role.CUSTOMER })
      );

      await service.register({
        email: "new@example.com",
        password: "supersecret"
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "auth.user.created",
        expect.objectContaining({
          aggregateType: "user",
          aggregateId: "user-created-1",
          emittedBy: "auth",
          payload: { userId: "user-created-1", role: Role.CUSTOMER }
        })
      );
    });

    it("propagates duplicate email as ConflictException", async () => {
      const { service, usersFacade } = createService();
      usersFacade.createUser.mockRejectedValue(
        new ConflictException({ code: "USER_ALREADY_EXISTS", message: "exists" })
      );

      await expect(
        service.register({ email: "x@y.com", password: "supersecret" })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("returns tokens for valid credentials", async () => {
      const { service, usersFacade } = createService();
      const passwordHash = await argon2Hash("correct horse");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));

      const result = await service.login({ email: "user@example.com", password: "correct horse" });

      expect(result.accessToken).toBe("signed.access.jwt");
      expect(usersFacade.resetFailedLogins).toHaveBeenCalledWith("user-1");
      expect(usersFacade.recordFailedLogin).not.toHaveBeenCalled();
    });

    it("rejects unknown email with generic error", async () => {
      const { service, usersFacade } = createService();
      usersFacade.findAuthByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "anything" })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "INVALID_CREDENTIALS" })
      });
    });

    it("rejects wrong password and records failed login", async () => {
      const { service, usersFacade } = createService();
      const passwordHash = await argon2Hash("correct horse");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.login({ email: "user@example.com", password: "wrong" })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "INVALID_CREDENTIALS" })
      });

      expect(usersFacade.recordFailedLogin).toHaveBeenCalledWith("user-1");
    });

    it("rejects locked account before checking password", async () => {
      const { service, usersFacade } = createService();
      usersFacade.findAuthByEmail.mockResolvedValue(
        makeUser({
          passwordHash: "irrelevant",
          isLocked: true,
          lockedUntil: new Date(Date.now() + 60_000).toISOString()
        })
      );

      await expect(
        service.login({ email: "user@example.com", password: "irrelevant" })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "ACCOUNT_LOCKED" })
      });

      expect(usersFacade.recordFailedLogin).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("rotates the refresh token and revokes the old one", async () => {
      const { service, usersFacade, refreshStore } = createService();
      const passwordHash = await argon2Hash("any");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));
      usersFacade.findAuthById.mockResolvedValue(makeUser({ passwordHash }));

      const login = await service.login({ email: "user@example.com", password: "any" });

      const refreshed = await service.refresh({ refreshToken: login.refreshToken });

      expect(refreshed.refreshToken).not.toBe(login.refreshToken);

      const oldTokenId = login.refreshToken.split(".")[0];
      expect(refreshStore.get(oldTokenId)?.revokedAt).toBeInstanceOf(Date);
      expect(refreshStore.get(oldTokenId)?.revokedReason).toBe("rotated");

      const newTokenId = refreshed.refreshToken.split(".")[0];
      expect(refreshStore.get(oldTokenId)?.replacedById).toBe(newTokenId);
      expect(refreshStore.get(newTokenId)?.familyId).toBe(refreshStore.get(oldTokenId)?.familyId);
    });

    it("rejects an already-rotated token and invalidates the family (reuse detection)", async () => {
      const { service, usersFacade, refreshStore } = createService();
      const passwordHash = await argon2Hash("any");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));
      usersFacade.findAuthById.mockResolvedValue(makeUser({ passwordHash }));

      const login = await service.login({ email: "user@example.com", password: "any" });
      const firstRotation = await service.refresh({ refreshToken: login.refreshToken });

      // Reuse the OLD token
      await expect(
        service.refresh({ refreshToken: login.refreshToken })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "REFRESH_TOKEN_REUSED" })
      });

      // The currently-active rotated token should now also be revoked (family invalidation)
      const newTokenId = firstRotation.refreshToken.split(".")[0];
      expect(refreshStore.get(newTokenId)?.revokedAt).toBeInstanceOf(Date);
    });

    it("does not allow two concurrent refresh requests to both succeed", async () => {
      const { service, usersFacade, refreshStore } = createService();
      const passwordHash = await argon2Hash("any");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));
      usersFacade.findAuthById.mockResolvedValue(makeUser({ passwordHash }));

      const login = await service.login({ email: "user@example.com", password: "any" });
      const results = await Promise.allSettled([
        service.refresh({ refreshToken: login.refreshToken }),
        service.refresh({ refreshToken: login.refreshToken })
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

      const activeTokens = Array.from(refreshStore.values()).filter(
        (token) => token.revokedAt === null
      );
      expect(activeTokens).toHaveLength(0);
    });

    it("rejects malformed refresh tokens with generic error", async () => {
      const { service } = createService();

      await expect(
        service.refresh({ refreshToken: "definitely-not-a-token-but-meets-length-requirements-aaaaaaaaaaaaaaaaaaaaaa" })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "INVALID_REFRESH_TOKEN" })
      });
    });

    it("rejects unknown token IDs", async () => {
      const { service, cryptoService } = createService();
      const generated = cryptoService.generateRefreshToken();

      await expect(
        service.refresh({ refreshToken: generated.token })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "INVALID_REFRESH_TOKEN" })
      });
    });

    it("rejects expired refresh tokens", async () => {
      const { service, usersFacade, refreshStore } = createService();
      const passwordHash = await argon2Hash("any");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));

      const login = await service.login({ email: "user@example.com", password: "any" });
      const tokenId = login.refreshToken.split(".")[0];
      const stored = refreshStore.get(tokenId);

      if (stored !== undefined) {
        stored.expiresAt = new Date(Date.now() - 1000);
      }

      await expect(
        service.refresh({ refreshToken: login.refreshToken })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "REFRESH_TOKEN_EXPIRED" })
      });
    });
  });

  describe("logout", () => {
    it("revokes the active refresh token", async () => {
      const { service, usersFacade, refreshStore } = createService();
      const passwordHash = await argon2Hash("any");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));

      const login = await service.login({ email: "user@example.com", password: "any" });
      await service.logout({ refreshToken: login.refreshToken });

      const tokenId = login.refreshToken.split(".")[0];
      expect(refreshStore.get(tokenId)?.revokedAt).toBeInstanceOf(Date);
      expect(refreshStore.get(tokenId)?.revokedReason).toBe("logout");
    });

    it("is idempotent for malformed or unknown tokens", async () => {
      const { service } = createService();

      await expect(
        service.logout({
          refreshToken: "garbage-but-length-meets-min-requirements-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        })
      ).resolves.toBeUndefined();
    });

    it("does not revoke after a token was already rotated", async () => {
      const { service, usersFacade, refreshStore } = createService();
      const passwordHash = await argon2Hash("any");
      usersFacade.findAuthByEmail.mockResolvedValue(makeUser({ passwordHash }));
      usersFacade.findAuthById.mockResolvedValue(makeUser({ passwordHash }));

      const login = await service.login({ email: "user@example.com", password: "any" });
      const firstRefresh = await service.refresh({ refreshToken: login.refreshToken });

      const oldTokenId = login.refreshToken.split(".")[0];
      const originalRevokedReason = refreshStore.get(oldTokenId)?.revokedReason;

      await service.logout({ refreshToken: login.refreshToken });

      // The reason should remain "rotated", not be changed to "logout"
      expect(refreshStore.get(oldTokenId)?.revokedReason).toBe(originalRevokedReason);

      // And the currently-active token should still be valid
      const newTokenId = firstRefresh.refreshToken.split(".")[0];
      expect(refreshStore.get(newTokenId)?.revokedAt).toBeNull();
    });
  });
});
