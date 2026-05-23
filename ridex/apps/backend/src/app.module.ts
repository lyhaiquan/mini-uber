import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { RequestLoggingMiddleware } from "./common/middleware/request-logging.middleware";
import { validateEnvironment, type EnvironmentVariables } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { DriversModule } from "./drivers/drivers.module";
import { GeoModule } from "./geo/geo.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./infra/redis/redis.module";
import { LocationModule } from "./location/location.module";
import { MatchingModule } from "./matching/matching.module";
import { PaymentsModule } from "./payments/payments.module";
import { PricingModule } from "./pricing/pricing.module";
import { RoutingModule } from "./routing/routing.module";
import { RidesModule } from "./rides/rides.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnvironment
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
        connection: {
          url: configService.get("REDIS_URL", { infer: true })
        }
      })
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CommonModule,
    RedisModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    DriversModule,
    LocationModule,
    GeoModule,
    RoutingModule,
    MatchingModule,
    PricingModule,
    PaymentsModule,
    RidesModule,
    AdminModule,
    HealthModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
    consumer
      .apply(RequestLoggingMiddleware)
      .exclude({ path: "health", method: RequestMethod.GET })
      .forRoutes("*");
  }
}
