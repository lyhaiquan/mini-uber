import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { GeoModule } from "../geo/geo.module";
import { RoutingModule } from "../routing/routing.module";
import { PricingSnapshot } from "./entities/pricing-snapshot.entity";
import { FareCalculatorService } from "./fare/fare-calculator.service";
import { RideRequestedPricingListener } from "./listeners/ride-requested.pricing-listener";
import { PricingFacade } from "./pricing.facade";
import { PricingSnapshotRepository } from "./snapshot/pricing-snapshot.repository";
import { SurgeService } from "./surge/surge.service";

@Module({
  imports: [TypeOrmModule.forFeature([PricingSnapshot]), GeoModule, RoutingModule],
  providers: [
    FareCalculatorService,
    SurgeService,
    PricingSnapshotRepository,
    RideRequestedPricingListener,
    PricingFacade
  ],
  exports: [PricingFacade]
})
export class PricingModule {}
