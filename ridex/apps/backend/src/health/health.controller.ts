import { Controller, Get, Req } from "@nestjs/common";

import { Public } from "../common/decorators/public.decorator";
import { getRequestId, type RequestWithCorrelationId } from "../common/request-context";
import { HealthService } from "./health.service";
import type { HealthResponse } from "./health.types";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(@Req() request: RequestWithCorrelationId): HealthResponse {
    return this.healthService.getHealth(getRequestId(request));
  }
}
