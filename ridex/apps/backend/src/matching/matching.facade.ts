import { Injectable } from "@nestjs/common";

import { RideOffer } from "./entities/ride-offer.entity";
import { OfferOrchestratorService } from "./offer/offer-orchestrator.service";
import { RideOfferRepository } from "./offer/ride-offer.repository";

@Injectable()
export class MatchingFacade {
  constructor(
    private readonly orchestrator: OfferOrchestratorService,
    private readonly offerRepository: RideOfferRepository
  ) {}

  async startMatching(rideId: string): Promise<void> {
    await this.orchestrator.startMatching(rideId);
  }

  async findOfferForDriver(driverUserId: string): Promise<RideOffer | null> {
    return this.offerRepository.findActiveOfferForDriver(driverUserId);
  }
}

