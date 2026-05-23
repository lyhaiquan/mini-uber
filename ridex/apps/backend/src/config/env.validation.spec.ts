import { validateEnvironment } from "./env.validation";

const validEnvironment = {
  NODE_ENV: "test",
  PORT: "3000",
  API_PREFIX: "api/v1",
  APP_NAME: "RideX Backend",
  LOG_LEVEL: "log",
  CORS_ORIGINS: "http://localhost:3001,http://localhost:3002",
  DATABASE_URL: "postgres://ridex:ridex@localhost:5432/ridex",
  DATABASE_SSL: "false",
  JWT_ACCESS_SECRET: "access-secret-32-chars-min-length-aaa",
  JWT_REFRESH_SECRET: "refresh-secret-32-chars-min-length-bb",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "7d",
  AUTH_LOCKOUT_MAX_ATTEMPTS: "5",
  AUTH_LOCKOUT_WINDOW_MS: "900000",
  AUTH_LOCKOUT_DURATION_MS: "900000",
  REDIS_URL: "redis://localhost:6379",
  DRIVER_LOCATION_TTL_SECONDS: "60",
  LOCATION_MAX_SPEED_MPS: "55",
  LOCATION_MAX_JUMP_METERS: "1000",
  LOCATION_JUMP_DETECTION_WINDOW_SECONDS: "30",
  WS_PATH: "/socket.io",
  H3_DISCOVERY_MAX_RING: "5",
  H3_STALE_SWEEP_INTERVAL_SECONDS: "30",
  OSRM_BASE_URL: "http://osrm:5000",
  OSRM_TIMEOUT_MS: "1500",
  ROUTING_FALLBACK_ROAD_FACTOR: "1.3",
  ROUTING_FALLBACK_CITY_SPEED_KMH: "30",
  ROUTING_ESTIMATE_CACHE_SIZE: "1024",
  ROUTING_ESTIMATE_CACHE_TTL_SECONDS: "60",
  MATCHING_MAX_CANDIDATES: "5",
  MATCHING_OFFER_TIMEOUT_SECONDS: "15",
  MATCHING_DISCOVERY_MAX_RING: "3",
  MATCHING_SCORE_DISTANCE_WEIGHT: "0.6",
  MATCHING_SCORE_ETA_WEIGHT: "0.4",
  PRICING_BASE_FARE_VND: "12000",
  PRICING_PER_KM_VND: "5000",
  PRICING_PER_MIN_VND: "500",
  PRICING_MINIMUM_FARE_VND: "15000",
  PRICING_SURGE_RATIO_THRESHOLD: "1.0",
  PRICING_SURGE_COEFFICIENT: "0.5",
  PRICING_SURGE_CAP: "3.0",
  PRICING_DEMAND_WINDOW_SECONDS: "300",
  PAYMENT_WALLET_SEED_VND: "500000",
  PAYMENT_DRIVER_SHARE_BPS: "8000",
  PAYMENT_PLATFORM_SHARE_BPS: "2000"
};

describe("validateEnvironment", () => {
  it("returns typed environment values for valid config", () => {
    expect(validateEnvironment(validEnvironment)).toEqual({
      NODE_ENV: "test",
      PORT: 3000,
      API_PREFIX: "api/v1",
      APP_NAME: "RideX Backend",
      LOG_LEVEL: "log",
      CORS_ORIGINS: ["http://localhost:3001", "http://localhost:3002"],
      DATABASE_URL: "postgres://ridex:ridex@localhost:5432/ridex",
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
      PAYMENT_WALLET_SEED_VND: 500000,
      PAYMENT_DRIVER_SHARE_BPS: 8000,
      PAYMENT_PLATFORM_SHARE_BPS: 2000,
      ADMIN_BOOTSTRAP_EMAIL: null,
      ADMIN_BOOTSTRAP_PASSWORD: null
    });
  });

  it("admin bootstrap keys default to null when not provided", () => {
    const env = validateEnvironment(validEnvironment);
    expect(env.ADMIN_BOOTSTRAP_EMAIL).toBeNull();
    expect(env.ADMIN_BOOTSTRAP_PASSWORD).toBeNull();
  });

  it("accepts a valid admin bootstrap email + password pair", () => {
    const env = validateEnvironment({
      ...validEnvironment,
      ADMIN_BOOTSTRAP_EMAIL: "admin@ridex.local",
      ADMIN_BOOTSTRAP_PASSWORD: "very-strong-admin-pw-2026"
    });
    expect(env.ADMIN_BOOTSTRAP_EMAIL).toBe("admin@ridex.local");
    expect(env.ADMIN_BOOTSTRAP_PASSWORD).toBe("very-strong-admin-pw-2026");
  });

  it("rejects a malformed ADMIN_BOOTSTRAP_EMAIL", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ADMIN_BOOTSTRAP_EMAIL: "not-an-email"
      })
    ).toThrow(/ADMIN_BOOTSTRAP_EMAIL must be a valid email/);
  });

  it("rejects an ADMIN_BOOTSTRAP_PASSWORD shorter than 12 chars", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ADMIN_BOOTSTRAP_PASSWORD: "short"
      })
    ).toThrow(/ADMIN_BOOTSTRAP_PASSWORD must be between 12 and 128 characters/);
  });

  it("fails fast when a required value is missing", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_NAME: ""
      })
    ).toThrow(/APP_NAME is required/);
  });

  it("rejects an invalid port", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PORT: "not-a-port"
      })
    ).toThrow(/PORT must be an integer/);
  });

  it("rejects an unsafe API prefix", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        API_PREFIX: "/api/v1"
      })
    ).toThrow(/API_PREFIX must be a slash-delimited path/);
  });

  it("rejects an invalid CORS origin", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CORS_ORIGINS: "http://localhost:3001,*"
      })
    ).toThrow(/CORS_ORIGINS contains an invalid URL/);
  });

  it("rejects unsupported log levels", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        LOG_LEVEL: "info"
      })
    ).toThrow(/LOG_LEVEL must be one of: error, warn, log, debug, verbose/);
  });

  it("rejects a short JWT secret", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: "too-short"
      })
    ).toThrow(/JWT_ACCESS_SECRET must be at least 32 characters/);
  });

  it("rejects identical JWT access and refresh secrets", () => {
    const sharedSecret = "shared-secret-32-chars-min-length-abc";
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: sharedSecret,
        JWT_REFRESH_SECRET: sharedSecret
      })
    ).toThrow(/JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different/);
  });

  it("rejects malformed TTL values", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_TTL: "fifteen-minutes"
      })
    ).toThrow(/TTL value must match pattern/);
  });

  it("rejects non-postgres DATABASE_URL", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL: "mysql://user:pass@localhost:3306/db"
      })
    ).toThrow(/DATABASE_URL must use postgres or postgresql protocol/);
  });

  it("rejects out-of-range lockout settings", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        AUTH_LOCKOUT_MAX_ATTEMPTS: "0"
      })
    ).toThrow(/AUTH_LOCKOUT_MAX_ATTEMPTS must be an integer between/);
  });

  it("requires Redis and location settings", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_URL: ""
      })
    ).toThrow(/REDIS_URL is required/);
  });

  it("rejects non-Redis REDIS_URL values", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_URL: "http://localhost:6379"
      })
    ).toThrow(/REDIS_URL must use redis or rediss protocol/);
  });

  it("rejects out-of-range location numeric settings", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DRIVER_LOCATION_TTL_SECONDS: "0"
      })
    ).toThrow(/DRIVER_LOCATION_TTL_SECONDS must be an integer between/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        LOCATION_MAX_SPEED_MPS: "0"
      })
    ).toThrow(/LOCATION_MAX_SPEED_MPS must be an integer between/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        LOCATION_MAX_JUMP_METERS: "0"
      })
    ).toThrow(/LOCATION_MAX_JUMP_METERS must be an integer between/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        LOCATION_JUMP_DETECTION_WINDOW_SECONDS: "0"
      })
    ).toThrow(/LOCATION_JUMP_DETECTION_WINDOW_SECONDS must be an integer between/);
  });

  it("rejects invalid WebSocket paths", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        WS_PATH: "socket.io"
      })
    ).toThrow(/WS_PATH must be an absolute Socket.IO path/);
  });

  it("rejects out-of-range H3 discovery settings", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        H3_DISCOVERY_MAX_RING: "21"
      })
    ).toThrow(/H3_DISCOVERY_MAX_RING must be an integer between/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        H3_STALE_SWEEP_INTERVAL_SECONDS: "4"
      })
    ).toThrow(/H3_STALE_SWEEP_INTERVAL_SECONDS must be an integer between/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        H3_STALE_SWEEP_INTERVAL_SECONDS: "601"
      })
    ).toThrow(/H3_STALE_SWEEP_INTERVAL_SECONDS must be an integer between/);
  });

  it("allows H3_DISCOVERY_MAX_RING = 0 (center cell only)", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        H3_DISCOVERY_MAX_RING: "0"
      })
    ).not.toThrow();
  });

  it("uses routing defaults when OSRM and fallback settings are omitted", () => {
    const {
      OSRM_BASE_URL,
      OSRM_TIMEOUT_MS,
      ROUTING_FALLBACK_ROAD_FACTOR,
      ROUTING_FALLBACK_CITY_SPEED_KMH,
      ROUTING_ESTIMATE_CACHE_SIZE,
      ROUTING_ESTIMATE_CACHE_TTL_SECONDS,
      ...withoutRoutingSettings
    } = validEnvironment;

    expect(validateEnvironment(withoutRoutingSettings)).toMatchObject({
      OSRM_BASE_URL: "http://osrm:5000",
      OSRM_TIMEOUT_MS: 1500,
      ROUTING_FALLBACK_ROAD_FACTOR: 1.3,
      ROUTING_FALLBACK_CITY_SPEED_KMH: 30,
      ROUTING_ESTIMATE_CACHE_SIZE: 1024,
      ROUTING_ESTIMATE_CACHE_TTL_SECONDS: 60
    });
    void OSRM_BASE_URL;
    void OSRM_TIMEOUT_MS;
    void ROUTING_FALLBACK_ROAD_FACTOR;
    void ROUTING_FALLBACK_CITY_SPEED_KMH;
    void ROUTING_ESTIMATE_CACHE_SIZE;
    void ROUTING_ESTIMATE_CACHE_TTL_SECONDS;
  });

  it("rejects invalid OSRM_BASE_URL values", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        OSRM_BASE_URL: "ftp://osrm:5000"
      })
    ).toThrow(/OSRM_BASE_URL must use http or https protocol/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        OSRM_BASE_URL: "not-a-url"
      })
    ).toThrow(/OSRM_BASE_URL must be a valid URL/);
  });

  it("rejects out-of-range OSRM_TIMEOUT_MS values", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        OSRM_TIMEOUT_MS: "99"
      })
    ).toThrow(/OSRM_TIMEOUT_MS must be an integer between 100 and 30000/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        OSRM_TIMEOUT_MS: "30001"
      })
    ).toThrow(/OSRM_TIMEOUT_MS must be an integer between 100 and 30000/);
  });

  it("rejects out-of-range fallback road factors", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_FALLBACK_ROAD_FACTOR: "1"
      })
    ).toThrow(/ROUTING_FALLBACK_ROAD_FACTOR must be a number greater than 1/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_FALLBACK_ROAD_FACTOR: "3.1"
      })
    ).toThrow(/ROUTING_FALLBACK_ROAD_FACTOR must be a number greater than 1/);
  });

  it("rejects out-of-range fallback city speeds", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_FALLBACK_CITY_SPEED_KMH: "4"
      })
    ).toThrow(/ROUTING_FALLBACK_CITY_SPEED_KMH must be an integer between 5 and 120/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_FALLBACK_CITY_SPEED_KMH: "121"
      })
    ).toThrow(/ROUTING_FALLBACK_CITY_SPEED_KMH must be an integer between 5 and 120/);
  });

  it("rejects out-of-range routing estimate cache settings", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_ESTIMATE_CACHE_SIZE: "15"
      })
    ).toThrow(/ROUTING_ESTIMATE_CACHE_SIZE must be an integer between 16 and 16384/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_ESTIMATE_CACHE_TTL_SECONDS: "601"
      })
    ).toThrow(
      /ROUTING_ESTIMATE_CACHE_TTL_SECONDS must be an integer between 1 and 600/
    );
  });

  it("rejects non-numeric routing timeout and fallback settings", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        OSRM_TIMEOUT_MS: "slow"
      })
    ).toThrow(/OSRM_TIMEOUT_MS must be an integer between 100 and 30000/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_FALLBACK_ROAD_FACTOR: "farther"
      })
    ).toThrow(/ROUTING_FALLBACK_ROAD_FACTOR must be a number greater than 1/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_FALLBACK_CITY_SPEED_KMH: "fast"
      })
    ).toThrow(/ROUTING_FALLBACK_CITY_SPEED_KMH must be an integer between 5 and 120/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        ROUTING_ESTIMATE_CACHE_SIZE: "many"
      })
    ).toThrow(/ROUTING_ESTIMATE_CACHE_SIZE must be an integer between 16 and 16384/);
  });

  it("uses matching defaults when matching settings are omitted", () => {
    const {
      MATCHING_MAX_CANDIDATES,
      MATCHING_OFFER_TIMEOUT_SECONDS,
      MATCHING_DISCOVERY_MAX_RING,
      MATCHING_SCORE_DISTANCE_WEIGHT,
      MATCHING_SCORE_ETA_WEIGHT,
      ...withoutMatchingSettings
    } = validEnvironment;

    expect(validateEnvironment(withoutMatchingSettings)).toMatchObject({
      MATCHING_MAX_CANDIDATES: 5,
      MATCHING_OFFER_TIMEOUT_SECONDS: 15,
      MATCHING_DISCOVERY_MAX_RING: 3,
      MATCHING_SCORE_DISTANCE_WEIGHT: 0.6,
      MATCHING_SCORE_ETA_WEIGHT: 0.4
    });
    void MATCHING_MAX_CANDIDATES;
    void MATCHING_OFFER_TIMEOUT_SECONDS;
    void MATCHING_DISCOVERY_MAX_RING;
    void MATCHING_SCORE_DISTANCE_WEIGHT;
    void MATCHING_SCORE_ETA_WEIGHT;
  });

  it("rejects out-of-range matching candidate and timeout settings", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MATCHING_MAX_CANDIDATES: "0"
      })
    ).toThrow(/MATCHING_MAX_CANDIDATES must be an integer between 1 and 50/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MATCHING_OFFER_TIMEOUT_SECONDS: "121"
      })
    ).toThrow(/MATCHING_OFFER_TIMEOUT_SECONDS must be an integer between 5 and 120/);
  });

  it("rejects out-of-range matching discovery ring values", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MATCHING_DISCOVERY_MAX_RING: "-1"
      })
    ).toThrow(/MATCHING_DISCOVERY_MAX_RING must be an integer between 0 and 20/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MATCHING_DISCOVERY_MAX_RING: "21"
      })
    ).toThrow(/MATCHING_DISCOVERY_MAX_RING must be an integer between 0 and 20/);
  });

  it("rejects out-of-range matching score weights", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MATCHING_SCORE_DISTANCE_WEIGHT: "0"
      })
    ).toThrow(/MATCHING_SCORE_DISTANCE_WEIGHT must be a number greater than 0/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MATCHING_SCORE_ETA_WEIGHT: "1.1"
      })
    ).toThrow(/MATCHING_SCORE_ETA_WEIGHT must be a number greater than 0/);
  });

  it("rejects matching score weights that do not sum to 1", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MATCHING_SCORE_DISTANCE_WEIGHT: "0.7",
        MATCHING_SCORE_ETA_WEIGHT: "0.4"
      })
    ).toThrow(/MATCHING_SCORE_DISTANCE_WEIGHT and MATCHING_SCORE_ETA_WEIGHT must sum to 1\.0/);
  });

  it("uses pricing defaults when pricing settings are omitted", () => {
    const {
      PRICING_BASE_FARE_VND,
      PRICING_PER_KM_VND,
      PRICING_PER_MIN_VND,
      PRICING_MINIMUM_FARE_VND,
      PRICING_SURGE_RATIO_THRESHOLD,
      PRICING_SURGE_COEFFICIENT,
      PRICING_SURGE_CAP,
      PRICING_DEMAND_WINDOW_SECONDS,
      ...withoutPricingSettings
    } = validEnvironment;

    expect(validateEnvironment(withoutPricingSettings)).toMatchObject({
      PRICING_BASE_FARE_VND: 12000,
      PRICING_PER_KM_VND: 5000,
      PRICING_PER_MIN_VND: 500,
      PRICING_MINIMUM_FARE_VND: 15000,
      PRICING_SURGE_RATIO_THRESHOLD: 1,
      PRICING_SURGE_COEFFICIENT: 0.5,
      PRICING_SURGE_CAP: 3,
      PRICING_DEMAND_WINDOW_SECONDS: 300
    });
    void PRICING_BASE_FARE_VND;
    void PRICING_PER_KM_VND;
    void PRICING_PER_MIN_VND;
    void PRICING_MINIMUM_FARE_VND;
    void PRICING_SURGE_RATIO_THRESHOLD;
    void PRICING_SURGE_COEFFICIENT;
    void PRICING_SURGE_CAP;
    void PRICING_DEMAND_WINDOW_SECONDS;
  });

  it("rejects out-of-range pricing fare values", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PRICING_BASE_FARE_VND: "-1"
      })
    ).toThrow(/PRICING_BASE_FARE_VND must be an integer between 0 and 1000000/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PRICING_PER_MIN_VND: "100001"
      })
    ).toThrow(/PRICING_PER_MIN_VND must be an integer between 0 and 100000/);
  });

  it("rejects out-of-range surge cap and coefficients", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PRICING_SURGE_CAP: "0.5"
      })
    ).toThrow(/PRICING_SURGE_CAP must be a number between 1 and 9\.999/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PRICING_SURGE_CAP: "10"
      })
    ).toThrow(/PRICING_SURGE_CAP must be a number between 1 and 9\.999/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PRICING_SURGE_COEFFICIENT: "0"
      })
    ).toThrow(/PRICING_SURGE_COEFFICIENT must be a number greater than 0/);
  });

  it("allows PRICING_SURGE_CAP at the numeric(4,3) database maximum", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PRICING_SURGE_CAP: "9.999"
      })
    ).not.toThrow();
  });

  it("rejects out-of-range pricing demand window", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PRICING_DEMAND_WINDOW_SECONDS: "9"
      })
    ).toThrow(/PRICING_DEMAND_WINDOW_SECONDS must be an integer between 10 and 3600/);
  });

  it("uses payment defaults when payment settings are omitted", () => {
    const {
      PAYMENT_WALLET_SEED_VND,
      PAYMENT_DRIVER_SHARE_BPS,
      PAYMENT_PLATFORM_SHARE_BPS,
      ...withoutPaymentSettings
    } = validEnvironment;

    expect(validateEnvironment(withoutPaymentSettings)).toMatchObject({
      PAYMENT_WALLET_SEED_VND: 500_000,
      PAYMENT_DRIVER_SHARE_BPS: 8000,
      PAYMENT_PLATFORM_SHARE_BPS: 2000
    });
    void PAYMENT_WALLET_SEED_VND;
    void PAYMENT_DRIVER_SHARE_BPS;
    void PAYMENT_PLATFORM_SHARE_BPS;
  });

  it("rejects out-of-range wallet seed", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PAYMENT_WALLET_SEED_VND: "-1"
      })
    ).toThrow(/PAYMENT_WALLET_SEED_VND must be an integer between 0 and 10000000/);
  });

  it("rejects out-of-range payment BPS values", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PAYMENT_DRIVER_SHARE_BPS: "0"
      })
    ).toThrow(/PAYMENT_DRIVER_SHARE_BPS must be an integer between 1 and 9999/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PAYMENT_PLATFORM_SHARE_BPS: "10000"
      })
    ).toThrow(/PAYMENT_PLATFORM_SHARE_BPS must be an integer between 1 and 9999/);
  });

  it("rejects payment BPS settings that do not sum to 10000", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PAYMENT_DRIVER_SHARE_BPS: "7000",
        PAYMENT_PLATFORM_SHARE_BPS: "2000"
      })
    ).toThrow(/PAYMENT_DRIVER_SHARE_BPS and PAYMENT_PLATFORM_SHARE_BPS must sum to 10000/);
  });
});
