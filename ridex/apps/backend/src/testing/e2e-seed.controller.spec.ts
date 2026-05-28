import { Module, type INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { configureApp } from "../app.setup";
import { CommonModule } from "../common/common.module";
import { validateEnvironment } from "../config/env.validation";
import { E2ESeedController } from "./e2e-seed.controller";
import { E2ESeedService } from "./e2e-seed.service";

describe("E2ESeedController gating", () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    jest.resetModules();
  });

  it("does not include TestingModule in AppModule imports when NODE_ENV === 'production'", async () => {
    const loaded = await loadAppModuleImports("production");

    expect(loaded.includesTestingModule).toBe(false);
  });

  it("includes TestingModule in AppModule imports when NODE_ENV !== 'production'", async () => {
    const loaded = await loadAppModuleImports("test");

    expect(loaded.includesTestingModule).toBe(true);
  });

  it("returns 404 when NODE_ENV === 'production'", async () => {
    const app = await buildHarnessApp("production");

    await request(app.getHttpServer())
      .post("/api/v1/testing/seed-driver-offer")
      .send({
        pickup: { lat: 10.77, lng: 106.7 },
        destination: { lat: 10.78, lng: 106.71 }
      })
      .expect(404);

    await app.close();
  });

  it("registers the route when NODE_ENV !== 'production'", async () => {
    const app = await buildHarnessApp("test");

    const response = await request(app.getHttpServer())
      .post("/api/v1/testing/seed-driver-offer")
      .send({
        testRunId: "phase-1",
        pickup: { lat: 10.77, lng: 106.7 },
        destination: { lat: 10.78, lng: 106.71 }
      });

    expect(response.status).not.toBe(404);

    await app.close();
  });
});

async function loadAppModuleImports(nodeEnv: string): Promise<{ includesTestingModule: boolean }> {
  setRequiredEnvironment(nodeEnv);

  const { AppModule } = await import("../app.module");
  const { TestingModule } = await import("./testing.module");
  const imports = Reflect.getMetadata("imports", AppModule) as unknown[] | undefined;

  return {
    includesTestingModule: (imports ?? []).some((item) => item === TestingModule)
  };
}

async function buildHarnessApp(nodeEnv: string): Promise<INestApplication> {
  setRequiredEnvironment(nodeEnv);

  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        cache: true,
        envFilePath: [".env", "../../.env"],
        validate: validateEnvironment
      }),
      CommonModule
    ],
    controllers: nodeEnv !== "production" ? [E2ESeedController] : [],
    providers: nodeEnv !== "production"
      ? [
          {
            provide: E2ESeedService,
            useValue: {
              seedDriverOffer: jest.fn().mockResolvedValue({
                mode: "prepare",
                testRunId: "phase-1",
                driver: {
                  userId: "stub-driver-user",
                  email: "e2e-driver@ridex.test",
                  password: "E2eMaestroTest!2026"
                },
                customer: {
                  userId: "stub-customer-user",
                  email: "e2e-customer@ridex.test",
                  password: "E2eMaestroTest!2026"
                },
                rideId: null,
                offerId: null
              })
            }
          }
        ]
      : []
  })
  class TestHarnessModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestHarnessModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}

function setRequiredEnvironment(nodeEnv: string): void {
  process.env.NODE_ENV = nodeEnv;
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
}
