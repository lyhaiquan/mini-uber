import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../config/env.validation";
import type { HealthResponse } from "./health.types";

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  getHealth(requestId: string): HealthResponse {
    return {
      data: {
        status: "ok",
        service: this.configService.get("APP_NAME", { infer: true }),
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime())
      },
      meta: {
        requestId
      }
    };
  }
}
