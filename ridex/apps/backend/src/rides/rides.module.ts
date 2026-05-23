import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { PricingModule } from "../pricing/pricing.module";
import { Ride } from "./entities/ride.entity";
import { RideEvent } from "./entities/ride-event.entity";
import { RideTransitionService } from "./ride-transition.service";
import { RidesController } from "./rides.controller";
import { RidesFacade } from "./rides.facade";
import { RidesService } from "./rides.service";

@Module({
  imports: [TypeOrmModule.forFeature([Ride, RideEvent]), PricingModule],
  controllers: [RidesController],
  providers: [RidesService, RideTransitionService, RidesFacade],
  exports: [RidesFacade]
})
export class RidesModule {}
