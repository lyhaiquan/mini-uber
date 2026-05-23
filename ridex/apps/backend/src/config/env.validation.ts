export type NodeEnvironment = "development" | "test" | "production";
export type LogLevel = "error" | "warn" | "log" | "debug" | "verbose";

export interface EnvironmentVariables {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  API_PREFIX: string;
  APP_NAME: string;
  LOG_LEVEL: LogLevel;
  CORS_ORIGINS: string[];
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  AUTH_LOCKOUT_MAX_ATTEMPTS: number;
  AUTH_LOCKOUT_WINDOW_MS: number;
  AUTH_LOCKOUT_DURATION_MS: number;
  REDIS_URL: string;
  DRIVER_LOCATION_TTL_SECONDS: number;
  LOCATION_MAX_SPEED_MPS: number;
  LOCATION_MAX_JUMP_METERS: number;
  LOCATION_JUMP_DETECTION_WINDOW_SECONDS: number;
  WS_PATH: string;
  H3_DISCOVERY_MAX_RING: number;
  H3_STALE_SWEEP_INTERVAL_SECONDS: number;
  OSRM_BASE_URL: string;
  OSRM_TIMEOUT_MS: number;
  ROUTING_FALLBACK_ROAD_FACTOR: number;
  ROUTING_FALLBACK_CITY_SPEED_KMH: number;
  ROUTING_ESTIMATE_CACHE_SIZE: number;
  ROUTING_ESTIMATE_CACHE_TTL_SECONDS: number;
  MATCHING_MAX_CANDIDATES: number;
  MATCHING_OFFER_TIMEOUT_SECONDS: number;
  MATCHING_DISCOVERY_MAX_RING: number;
  MATCHING_SCORE_DISTANCE_WEIGHT: number;
  MATCHING_SCORE_ETA_WEIGHT: number;
  PRICING_BASE_FARE_VND: number;
  PRICING_PER_KM_VND: number;
  PRICING_PER_MIN_VND: number;
  PRICING_MINIMUM_FARE_VND: number;
  PRICING_SURGE_RATIO_THRESHOLD: number;
  PRICING_SURGE_COEFFICIENT: number;
  PRICING_SURGE_CAP: number;
  PRICING_DEMAND_WINDOW_SECONDS: number;
  PAYMENT_WALLET_SEED_VND: number;
  PAYMENT_DRIVER_SHARE_BPS: number;
  PAYMENT_PLATFORM_SHARE_BPS: number;
  ADMIN_BOOTSTRAP_EMAIL: string | null;
  ADMIN_BOOTSTRAP_PASSWORD: string | null;
}

const NODE_ENV_VALUES: readonly NodeEnvironment[] = ["development", "test", "production"];
const LOG_LEVEL_VALUES: readonly LogLevel[] = ["error", "warn", "log", "debug", "verbose"];
const API_PREFIX_PATTERN = /^[a-z][a-z0-9-]*(\/[a-z0-9-]+)*$/;
const TTL_PATTERN = /^[0-9]+(ms|s|m|h|d)$/;
const WS_PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/;
const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_OSRM_BASE_URL = "http://osrm:5000";
const DEFAULT_OSRM_TIMEOUT_MS = 1500;
const DEFAULT_ROUTING_FALLBACK_ROAD_FACTOR = 1.3;
const DEFAULT_ROUTING_FALLBACK_CITY_SPEED_KMH = 30;
const DEFAULT_ROUTING_ESTIMATE_CACHE_SIZE = 1024;
const DEFAULT_ROUTING_ESTIMATE_CACHE_TTL_SECONDS = 60;
const DEFAULT_MATCHING_MAX_CANDIDATES = 5;
const DEFAULT_MATCHING_OFFER_TIMEOUT_SECONDS = 15;
const DEFAULT_MATCHING_DISCOVERY_MAX_RING = 3;
const DEFAULT_MATCHING_SCORE_DISTANCE_WEIGHT = 0.6;
const DEFAULT_MATCHING_SCORE_ETA_WEIGHT = 0.4;
const MATCHING_WEIGHT_SUM_TOLERANCE = 0.001;
const DEFAULT_PRICING_BASE_FARE_VND = 12000;
const DEFAULT_PRICING_PER_KM_VND = 5000;
const DEFAULT_PRICING_PER_MIN_VND = 500;
const DEFAULT_PRICING_MINIMUM_FARE_VND = 15000;
const DEFAULT_PRICING_SURGE_RATIO_THRESHOLD = 1.0;
const DEFAULT_PRICING_SURGE_COEFFICIENT = 0.5;
const DEFAULT_PRICING_SURGE_CAP = 3.0;
const MAX_PRICING_SURGE_CAP = 9.999;
const DEFAULT_PRICING_DEMAND_WINDOW_SECONDS = 300;
const DEFAULT_PAYMENT_WALLET_SEED_VND = 500_000;
const DEFAULT_PAYMENT_DRIVER_SHARE_BPS = 8000;
const DEFAULT_PAYMENT_PLATFORM_SHARE_BPS = 2000;
const MIN_ADMIN_BOOTSTRAP_PASSWORD_LENGTH = 12;
const MAX_ADMIN_BOOTSTRAP_PASSWORD_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const errors: string[] = [];

  const nodeEnvironment = readEnum(config, "NODE_ENV", NODE_ENV_VALUES, errors);
  const port = readPort(config, errors);
  const apiPrefix = readString(config, "API_PREFIX", errors, validateApiPrefix);
  const appName = readString(config, "APP_NAME", errors);
  const logLevel = readEnum(config, "LOG_LEVEL", LOG_LEVEL_VALUES, errors);
  const corsOrigins = readCorsOrigins(config, errors);
  const databaseUrl = readString(config, "DATABASE_URL", errors, validateDatabaseUrl);
  const databaseSsl = readBoolean(config, "DATABASE_SSL", errors, false);
  const accessSecret = readSecret(config, "JWT_ACCESS_SECRET", errors);
  const refreshSecret = readSecret(config, "JWT_REFRESH_SECRET", errors);

  if (accessSecret !== "" && refreshSecret !== "" && accessSecret === refreshSecret) {
    errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  }

  const accessTtl = readString(config, "JWT_ACCESS_TTL", errors, validateTtl);
  const refreshTtl = readString(config, "JWT_REFRESH_TTL", errors, validateTtl);
  const lockoutAttempts = readPositiveInteger(
    config,
    "AUTH_LOCKOUT_MAX_ATTEMPTS",
    errors,
    1,
    100
  );
  const lockoutWindowMs = readPositiveInteger(
    config,
    "AUTH_LOCKOUT_WINDOW_MS",
    errors,
    1000,
    24 * 60 * 60 * 1000
  );
  const lockoutDurationMs = readPositiveInteger(
    config,
    "AUTH_LOCKOUT_DURATION_MS",
    errors,
    1000,
    24 * 60 * 60 * 1000
  );
  const redisUrl = readString(config, "REDIS_URL", errors, validateRedisUrl);
  const driverLocationTtlSeconds = readPositiveInteger(
    config,
    "DRIVER_LOCATION_TTL_SECONDS",
    errors,
    1,
    24 * 60 * 60
  );
  const maxSpeedMps = readPositiveInteger(
    config,
    "LOCATION_MAX_SPEED_MPS",
    errors,
    1,
    200
  );
  const maxJumpMeters = readPositiveInteger(
    config,
    "LOCATION_MAX_JUMP_METERS",
    errors,
    1,
    100_000
  );
  const jumpDetectionWindowSeconds = readPositiveInteger(
    config,
    "LOCATION_JUMP_DETECTION_WINDOW_SECONDS",
    errors,
    1,
    24 * 60 * 60
  );
  const wsPath = readString(config, "WS_PATH", errors, validateWsPath);
  const h3DiscoveryMaxRing = readPositiveInteger(
    config,
    "H3_DISCOVERY_MAX_RING",
    errors,
    0,
    20
  );
  const h3StaleSweepIntervalSeconds = readPositiveInteger(
    config,
    "H3_STALE_SWEEP_INTERVAL_SECONDS",
    errors,
    5,
    600
  );
  const osrmBaseUrl = readStringWithDefault(
    config,
    "OSRM_BASE_URL",
    errors,
    DEFAULT_OSRM_BASE_URL,
    validateHttpUrl
  );
  const osrmTimeoutMs = readIntegerWithDefault(
    config,
    "OSRM_TIMEOUT_MS",
    errors,
    DEFAULT_OSRM_TIMEOUT_MS,
    100,
    30_000
  );
  const routingFallbackRoadFactor = readNumberWithDefault(
    config,
    "ROUTING_FALLBACK_ROAD_FACTOR",
    errors,
    DEFAULT_ROUTING_FALLBACK_ROAD_FACTOR,
    1,
    3,
    false
  );
  const routingFallbackCitySpeedKmh = readIntegerWithDefault(
    config,
    "ROUTING_FALLBACK_CITY_SPEED_KMH",
    errors,
    DEFAULT_ROUTING_FALLBACK_CITY_SPEED_KMH,
    5,
    120
  );
  const routingEstimateCacheSize = readIntegerWithDefault(
    config,
    "ROUTING_ESTIMATE_CACHE_SIZE",
    errors,
    DEFAULT_ROUTING_ESTIMATE_CACHE_SIZE,
    16,
    16_384
  );
  const routingEstimateCacheTtlSeconds = readIntegerWithDefault(
    config,
    "ROUTING_ESTIMATE_CACHE_TTL_SECONDS",
    errors,
    DEFAULT_ROUTING_ESTIMATE_CACHE_TTL_SECONDS,
    1,
    600
  );
  const matchingMaxCandidates = readIntegerWithDefault(
    config,
    "MATCHING_MAX_CANDIDATES",
    errors,
    DEFAULT_MATCHING_MAX_CANDIDATES,
    1,
    50
  );
  const matchingOfferTimeoutSeconds = readIntegerWithDefault(
    config,
    "MATCHING_OFFER_TIMEOUT_SECONDS",
    errors,
    DEFAULT_MATCHING_OFFER_TIMEOUT_SECONDS,
    5,
    120
  );
  const matchingDiscoveryMaxRing = readIntegerWithDefault(
    config,
    "MATCHING_DISCOVERY_MAX_RING",
    errors,
    DEFAULT_MATCHING_DISCOVERY_MAX_RING,
    0,
    20
  );
  const matchingScoreDistanceWeight = readNumberWithDefault(
    config,
    "MATCHING_SCORE_DISTANCE_WEIGHT",
    errors,
    DEFAULT_MATCHING_SCORE_DISTANCE_WEIGHT,
    0,
    1,
    false
  );
  const matchingScoreEtaWeight = readNumberWithDefault(
    config,
    "MATCHING_SCORE_ETA_WEIGHT",
    errors,
    DEFAULT_MATCHING_SCORE_ETA_WEIGHT,
    0,
    1,
    false
  );

  if (
    Math.abs(matchingScoreDistanceWeight + matchingScoreEtaWeight - 1) >
    MATCHING_WEIGHT_SUM_TOLERANCE
  ) {
    errors.push("MATCHING_SCORE_DISTANCE_WEIGHT and MATCHING_SCORE_ETA_WEIGHT must sum to 1.0");
  }

  const pricingBaseFareVnd = readIntegerWithDefault(
    config,
    "PRICING_BASE_FARE_VND",
    errors,
    DEFAULT_PRICING_BASE_FARE_VND,
    0,
    1_000_000
  );
  const pricingPerKmVnd = readIntegerWithDefault(
    config,
    "PRICING_PER_KM_VND",
    errors,
    DEFAULT_PRICING_PER_KM_VND,
    0,
    1_000_000
  );
  const pricingPerMinVnd = readIntegerWithDefault(
    config,
    "PRICING_PER_MIN_VND",
    errors,
    DEFAULT_PRICING_PER_MIN_VND,
    0,
    100_000
  );
  const pricingMinimumFareVnd = readIntegerWithDefault(
    config,
    "PRICING_MINIMUM_FARE_VND",
    errors,
    DEFAULT_PRICING_MINIMUM_FARE_VND,
    0,
    1_000_000
  );
  const pricingSurgeRatioThreshold = readNumberWithDefault(
    config,
    "PRICING_SURGE_RATIO_THRESHOLD",
    errors,
    DEFAULT_PRICING_SURGE_RATIO_THRESHOLD,
    0,
    10,
    false
  );
  const pricingSurgeCoefficient = readNumberWithDefault(
    config,
    "PRICING_SURGE_COEFFICIENT",
    errors,
    DEFAULT_PRICING_SURGE_COEFFICIENT,
    0,
    5,
    false
  );
  const pricingSurgeCap = readNumberWithDefault(
    config,
    "PRICING_SURGE_CAP",
    errors,
    DEFAULT_PRICING_SURGE_CAP,
    1,
    MAX_PRICING_SURGE_CAP,
    true
  );
  const pricingDemandWindowSeconds = readIntegerWithDefault(
    config,
    "PRICING_DEMAND_WINDOW_SECONDS",
    errors,
    DEFAULT_PRICING_DEMAND_WINDOW_SECONDS,
    10,
    3600
  );
  const paymentWalletSeedVnd = readIntegerWithDefault(
    config,
    "PAYMENT_WALLET_SEED_VND",
    errors,
    DEFAULT_PAYMENT_WALLET_SEED_VND,
    0,
    10_000_000
  );
  const paymentDriverShareBps = readIntegerWithDefault(
    config,
    "PAYMENT_DRIVER_SHARE_BPS",
    errors,
    DEFAULT_PAYMENT_DRIVER_SHARE_BPS,
    1,
    9999
  );
  const paymentPlatformShareBps = readIntegerWithDefault(
    config,
    "PAYMENT_PLATFORM_SHARE_BPS",
    errors,
    DEFAULT_PAYMENT_PLATFORM_SHARE_BPS,
    1,
    9999
  );

  if (paymentDriverShareBps + paymentPlatformShareBps !== 10_000) {
    errors.push("PAYMENT_DRIVER_SHARE_BPS and PAYMENT_PLATFORM_SHARE_BPS must sum to 10000");
  }

  const adminBootstrapEmail = readOptionalEmail(config, "ADMIN_BOOTSTRAP_EMAIL", errors);
  const adminBootstrapPassword = readOptionalPassword(
    config,
    "ADMIN_BOOTSTRAP_PASSWORD",
    errors,
    MIN_ADMIN_BOOTSTRAP_PASSWORD_LENGTH,
    MAX_ADMIN_BOOTSTRAP_PASSWORD_LENGTH
  );

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join("; ")}`);
  }

  return {
    NODE_ENV: nodeEnvironment,
    PORT: port,
    API_PREFIX: apiPrefix,
    APP_NAME: appName,
    LOG_LEVEL: logLevel,
    CORS_ORIGINS: corsOrigins,
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: databaseSsl,
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_TTL: accessTtl,
    JWT_REFRESH_TTL: refreshTtl,
    AUTH_LOCKOUT_MAX_ATTEMPTS: lockoutAttempts,
    AUTH_LOCKOUT_WINDOW_MS: lockoutWindowMs,
    AUTH_LOCKOUT_DURATION_MS: lockoutDurationMs,
    REDIS_URL: redisUrl,
    DRIVER_LOCATION_TTL_SECONDS: driverLocationTtlSeconds,
    LOCATION_MAX_SPEED_MPS: maxSpeedMps,
    LOCATION_MAX_JUMP_METERS: maxJumpMeters,
    LOCATION_JUMP_DETECTION_WINDOW_SECONDS: jumpDetectionWindowSeconds,
    WS_PATH: wsPath,
    H3_DISCOVERY_MAX_RING: h3DiscoveryMaxRing,
    H3_STALE_SWEEP_INTERVAL_SECONDS: h3StaleSweepIntervalSeconds,
    OSRM_BASE_URL: osrmBaseUrl,
    OSRM_TIMEOUT_MS: osrmTimeoutMs,
    ROUTING_FALLBACK_ROAD_FACTOR: routingFallbackRoadFactor,
    ROUTING_FALLBACK_CITY_SPEED_KMH: routingFallbackCitySpeedKmh,
    ROUTING_ESTIMATE_CACHE_SIZE: routingEstimateCacheSize,
    ROUTING_ESTIMATE_CACHE_TTL_SECONDS: routingEstimateCacheTtlSeconds,
    MATCHING_MAX_CANDIDATES: matchingMaxCandidates,
    MATCHING_OFFER_TIMEOUT_SECONDS: matchingOfferTimeoutSeconds,
    MATCHING_DISCOVERY_MAX_RING: matchingDiscoveryMaxRing,
    MATCHING_SCORE_DISTANCE_WEIGHT: matchingScoreDistanceWeight,
    MATCHING_SCORE_ETA_WEIGHT: matchingScoreEtaWeight,
    PRICING_BASE_FARE_VND: pricingBaseFareVnd,
    PRICING_PER_KM_VND: pricingPerKmVnd,
    PRICING_PER_MIN_VND: pricingPerMinVnd,
    PRICING_MINIMUM_FARE_VND: pricingMinimumFareVnd,
    PRICING_SURGE_RATIO_THRESHOLD: pricingSurgeRatioThreshold,
    PRICING_SURGE_COEFFICIENT: pricingSurgeCoefficient,
    PRICING_SURGE_CAP: pricingSurgeCap,
    PRICING_DEMAND_WINDOW_SECONDS: pricingDemandWindowSeconds,
    PAYMENT_WALLET_SEED_VND: paymentWalletSeedVnd,
    PAYMENT_DRIVER_SHARE_BPS: paymentDriverShareBps,
    PAYMENT_PLATFORM_SHARE_BPS: paymentPlatformShareBps,
    ADMIN_BOOTSTRAP_EMAIL: adminBootstrapEmail,
    ADMIN_BOOTSTRAP_PASSWORD: adminBootstrapPassword
  };
}

function readOptionalEmail(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[]
): string | null {
  const value = config[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) {
    errors.push(`${key} must be a valid email address`);
    return null;
  }

  return trimmed;
}

function readOptionalPassword(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[],
  minLength: number,
  maxLength: number
): string | null {
  const value = config[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return null;
  }

  if (value.length < minLength || value.length > maxLength) {
    errors.push(`${key} must be between ${minLength} and ${maxLength} characters`);
    return null;
  }

  return value;
}

function readEnum<TValue extends string>(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  allowedValues: readonly TValue[],
  errors: string[]
): TValue {
  const value = readString(config, key, errors);

  if (!allowedValues.includes(value as TValue)) {
    errors.push(`${key} must be one of: ${allowedValues.join(", ")}`);
  }

  return value as TValue;
}

function readPort(config: Record<string, unknown>, errors: string[]): number {
  const rawValue = readString(config, "PORT", errors);
  const port = Number(rawValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function readString(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[],
  validator?: (value: string) => string | undefined
): string {
  const value = config[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${key} is required`);
    return "";
  }

  const trimmedValue = value.trim();
  const validationError = validator?.(trimmedValue);

  if (validationError !== undefined) {
    errors.push(validationError);
  }

  return trimmedValue;
}

function readBoolean(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[],
  defaultValue: boolean
): boolean {
  const value = config[key];

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  errors.push(`${key} must be a boolean`);
  return defaultValue;
}

function readPositiveInteger(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[],
  min: number,
  max: number
): number {
  const rawValue = readString(config, key, errors);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}`);
  }

  return value;
}

function readIntegerWithDefault(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[],
  defaultValue: number,
  min: number,
  max: number
): number {
  const rawValue = readStringWithDefault(config, key, errors, String(defaultValue));
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}`);
  }

  return value;
}

function readNumberWithDefault(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[],
  defaultValue: number,
  min: number,
  max: number,
  inclusiveMin: boolean
): number {
  const rawValue = readStringWithDefault(config, key, errors, String(defaultValue));
  const value = Number(rawValue);
  const lowerBoundOk = inclusiveMin ? value >= min : value > min;

  if (!Number.isFinite(value) || !lowerBoundOk || value > max) {
    const range = inclusiveMin
      ? `between ${min} and ${max}`
      : `greater than ${min} and less than or equal to ${max}`;
    errors.push(`${key} must be a number ${range}`);
  }

  return value;
}

function readStringWithDefault(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[],
  defaultValue: string,
  validator?: (value: string) => string | undefined
): string {
  const value = config[key];

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return defaultValue;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return defaultValue;
  }

  const validationError = validator?.(trimmedValue);

  if (validationError !== undefined) {
    errors.push(validationError);
  }

  return trimmedValue;
}

function readSecret(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  errors: string[]
): string {
  const value = readString(config, key, errors);

  if (value !== "" && value.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`${key} must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }

  return value;
}

function validateApiPrefix(value: string): string | undefined {
  if (!API_PREFIX_PATTERN.test(value)) {
    return "API_PREFIX must be a slash-delimited path without leading or trailing slash";
  }

  return undefined;
}

function validateTtl(value: string): string | undefined {
  if (!TTL_PATTERN.test(value)) {
    return `TTL value must match pattern <number><ms|s|m|h|d>, got: ${value}`;
  }

  return undefined;
}

function validateDatabaseUrl(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
      return "DATABASE_URL must use postgres or postgresql protocol";
    }

    return undefined;
  } catch {
    return "DATABASE_URL must be a valid connection URL";
  }
}

function validateRedisUrl(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "redis:" && parsedUrl.protocol !== "rediss:") {
      return "REDIS_URL must use redis or rediss protocol";
    }

    return undefined;
  } catch {
    return "REDIS_URL must be a valid connection URL";
  }
}

function validateHttpUrl(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return "OSRM_BASE_URL must use http or https protocol";
    }

    return undefined;
  } catch {
    return "OSRM_BASE_URL must be a valid URL";
  }
}

function validateWsPath(value: string): string | undefined {
  if (!WS_PATH_PATTERN.test(value)) {
    return "WS_PATH must be an absolute Socket.IO path starting with /";
  }

  return undefined;
}

function readCorsOrigins(config: Record<string, unknown>, errors: string[]): string[] {
  const rawValue = readString(config, "CORS_ORIGINS", errors);
  const origins = rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    errors.push("CORS_ORIGINS must contain at least one origin");
    return [];
  }

  for (const origin of origins) {
    const validationError = validateCorsOrigin(origin);

    if (validationError !== undefined) {
      errors.push(validationError);
    }
  }

  return origins;
}

function validateCorsOrigin(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return `CORS_ORIGINS contains an origin that does not use http or https: ${value}`;
    }

    return undefined;
  } catch {
    return `CORS_ORIGINS contains an invalid URL: ${value}`;
  }
}
