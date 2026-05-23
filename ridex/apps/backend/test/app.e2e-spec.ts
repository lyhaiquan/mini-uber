import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

describe("Backend foundation (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    setRequiredEnvironment();
    const { TestAppModule } = await import("./test-app.module");
    const { configureApp } = await import("../src/app.setup");

    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it("GET /health returns an API envelope and preserves correlation ID", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("x-correlation-id", "test-request-id")
      .expect(200)
      .expect("x-correlation-id", "test-request-id");

    expect(response.body).toMatchObject({
      data: {
        status: "ok",
        service: "RideX Backend"
      },
      meta: {
        requestId: "test-request-id"
      }
    });
    expect(typeof response.body.data.timestamp).toBe("string");
    expect(typeof response.body.data.uptimeSeconds).toBe("number");
  });

  it("returns a safe API error envelope for unknown routes", async () => {
    const response = await request(app.getHttpServer())
      .get("/does-not-exist")
      .set("x-correlation-id", "missing-route-request")
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "HTTP_NOT_FOUND",
        message: "Cannot GET /does-not-exist"
      },
      meta: {
        requestId: "missing-route-request"
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });
});

function setRequiredEnvironment(): void {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.API_PREFIX = "api/v1";
  process.env.APP_NAME = "RideX Backend";
  process.env.LOG_LEVEL = "log";
  process.env.CORS_ORIGINS = "http://localhost:3001,http://localhost:3002";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.DATABASE_SSL = "false";
  process.env.JWT_ACCESS_SECRET = "test-access-secret-32-chars-min-length";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-32-chars-min-length";
  process.env.JWT_ACCESS_TTL = "15m";
  process.env.JWT_REFRESH_TTL = "7d";
  process.env.AUTH_LOCKOUT_MAX_ATTEMPTS = "5";
  process.env.AUTH_LOCKOUT_WINDOW_MS = "900000";
  process.env.AUTH_LOCKOUT_DURATION_MS = "900000";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.DRIVER_LOCATION_TTL_SECONDS = "60";
  process.env.LOCATION_MAX_SPEED_MPS = "55";
  process.env.LOCATION_MAX_JUMP_METERS = "1000";
  process.env.LOCATION_JUMP_DETECTION_WINDOW_SECONDS = "30";
  process.env.WS_PATH = "/socket.io";
  process.env.H3_DISCOVERY_MAX_RING = "5";
  process.env.H3_STALE_SWEEP_INTERVAL_SECONDS = "30";
}
