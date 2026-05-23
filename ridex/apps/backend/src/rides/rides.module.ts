import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";

import { PricingModule } from "../pricing/pricing.module";
import { UsersModule } from "../users/users.module";
import { Ride } from "./entities/ride.entity";
import { RideEvent } from "./entities/ride-event.entity";
import { RideTrackingGateway } from "./gateways/ride-tracking.gateway";
import { RideTransitionService } from "./ride-transition.service";
import { RidesController } from "./rides.controller";
import { RidesFacade } from "./rides.facade";
import { RidesService } from "./rides.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ride, RideEvent]),
    PricingModule,
    UsersModule,
    JwtModule.register({})
  ],
  controllers: [RidesController],
  providers: [RidesService, RideTransitionService, RidesFacade, RideTrackingGateway],
  exports: [RidesFacade]
})
export class RidesModule {}
