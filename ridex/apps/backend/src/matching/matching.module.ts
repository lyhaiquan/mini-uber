import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DriversModule } from "../drivers/drivers.module";
import { GeoModule } from "../geo/geo.module";
import { LocationModule } from "../location/location.module";
import { RidesModule } from "../rides/rides.module";
import { RoutingModule } from "../routing/routing.module";
import { CandidateScoringService } from "./candidates/candidate-scoring.service";
import { CandidateSelectionService } from "./candidates/candidate-selection.service";
import { DriverMeController } from "./driver-me.controller";
import { RideOffer } from "./entities/ride-offer.entity";
import { OfferGateway } from "./gateways/offer.gateway";
import { RideRequestedMatchingListener } from "./listeners/ride-requested.listener";
import { MATCHING_OFFER_TIMEOUT_QUEUE } from "./matching.constants";
import { MatchingFacade } from "./matching.facade";
import { OfferOrchestratorService } from "./offer/offer-orchestrator.service";
import { OfferTimeoutProcessor } from "./offer/offer-timeout.processor";
import { OfferTimeoutQueue } from "./offer/offer-timeout.queue";
import { RideOfferRepository } from "./offer/ride-offer.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([RideOffer]),
    BullModule.registerQueue({ name: MATCHING_OFFER_TIMEOUT_QUEUE }),
    JwtModule.register({}),
    RidesModule,
    DriversModule,
    GeoModule,
    LocationModule,
    RoutingModule
  ],
  controllers: [DriverMeController],
  providers: [
    CandidateScoringService,
    CandidateSelectionService,
    RideOfferRepository,
    OfferTimeoutQueue,
    OfferOrchestratorService,
    OfferTimeoutProcessor,
    RideRequestedMatchingListener,
    OfferGateway,
    MatchingFacade
  ],
  exports: [MatchingFacade]
})
export class MatchingModule {}
