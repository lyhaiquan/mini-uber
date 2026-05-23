import { Controller, Get, Req } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.types";
import { Roles } from "../auth/guards/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { StructuredLogger } from "../common/logging/structured-logger";
import type { RequestWithCorrelationId } from "../common/request-context";
import { Role } from "../users/dto/role.enum";
import { DashboardService } from "./dashboard/dashboard.service";
import type { DashboardSummaryDto } from "./dto/dashboard-summary.dto";

const CONTEXT = "AdminController";

@Controller("admin/dashboard")
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly logger: StructuredLogger
  ) {}

  @Get("summary")
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestWithCorrelationId
  ): Promise<{ data: DashboardSummaryDto }> {
    this.logger.log(
      {
        event: "admin.dashboard.accessed",
        userId: user.userId,
        correlationId: request.correlationId ?? null
      },
      CONTEXT
    );
    const data = await this.dashboardService.getSummary();
    return { data };
  }
}
