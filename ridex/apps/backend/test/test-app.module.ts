import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "../src/common/common.module";
import { CorrelationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { RequestLoggingMiddleware } from "../src/common/middleware/request-logging.middleware";
import { validateEnvironment } from "../src/config/env.validation";
import { HealthModule } from "../src/health/health.module";

/**
 * Minimal application module for foundation e2e tests.
 *
 * Intentionally excludes DatabaseModule, UsersModule, and AuthModule so the
 * foundation (config, middleware, exception filter, health check) can be
 * exercised without a running PostgreSQL instance. Auth-specific e2e tests
 * should compose a separate module that wires Auth+Users+TypeORM.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnvironment
    }),
    CommonModule,
    HealthModule
  ]
})
export class TestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
    consumer
      .apply(RequestLoggingMiddleware)
      .exclude({ path: "health", method: RequestMethod.GET })
      .forRoutes("*");
  }
}
