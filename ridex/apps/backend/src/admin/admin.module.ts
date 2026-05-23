import { Module } from "@nestjs/common";

import { DriversModule } from "../drivers/drivers.module";
import { PaymentsModule } from "../payments/payments.module";
import { RidesModule } from "../rides/rides.module";
import { AdminController } from "./admin.controller";
import { DashboardService } from "./dashboard/dashboard.service";

@Module({
  imports: [RidesModule, DriversModule, PaymentsModule],
  controllers: [AdminController],
  providers: [DashboardService]
})
export class AdminModule {}
