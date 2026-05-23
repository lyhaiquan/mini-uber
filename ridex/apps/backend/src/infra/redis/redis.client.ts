import type { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import type { EnvironmentVariables } from "../../config/env.validation";

export function createRedisClient(
  configService: ConfigService<EnvironmentVariables, true>
): Redis {
  return new Redis(configService.get("REDIS_URL", { infer: true }), {
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });
}
