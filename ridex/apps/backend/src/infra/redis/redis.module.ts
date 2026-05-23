import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/env.validation";
import { createRedisClient } from "./redis.client";
import { REDIS_CLIENT } from "./redis.tokens";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) =>
        createRedisClient(configService)
    }
  ],
  exports: [REDIS_CLIENT]
})
export class RedisModule {}

