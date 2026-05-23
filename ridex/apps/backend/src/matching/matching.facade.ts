import { Injectable } from "@nestjs/common";

import { RidesFacade } from "../rides/rides.facade";
import type { DriverOfferResponseDto } from "./dto/driver-offer-response.dto";
import { RideOffer } from "./entities/ride-offer.entity";
import { OfferOrchestratorService } from "./offer/offer-orchestrator.service";
import { RideOfferRepository } from "./offer/ride-offer.repository";

@Injectable()
export class MatchingFacade {
  constructor(
    private readonly orchestrator: OfferOrchestratorService,
    private readonly offerRepository: RideOfferRepository,
    private readonly ridesFacade: RidesFacade
  ) {}

  async startMatching(rideId: string): Promise<void> {
    await this.orchestrator.startMatching(rideId);
  }

  async findOfferForDriver(driverUserId: string): Promise<RideOffer | null> {
    return this.offerRepository.findActiveOfferForDriver(driverUserId);
  }

  // REST fallback for GET /drivers/me/offers/current. Joins the active offer
  // row with the ride's pickup/destination coords (the offer row only stores
  // distance/duration, not geo points). Returns null when the driver has no
  // pending offer so the FE keeps its modal closed instead of flashing stale
  // data.
  async getCurrentOfferForDriver(
    driverUserId: string
  ): Promise<DriverOfferResponseDto | null> {
    const offer = await this.offerRepository.findActiveOfferForDriver(driverUserId);
    if (offer === null) {
      return null;
    }

    const ride = await this.ridesFacade.getRideSummary(offer.rideId);
    if (ride === null) {
      // Defensive: offer row exists but ride is gone. Don't surface a
      // partial payload — the matching engine will sweep the orphan on its
      // own.
      return null;
    }

    return {
      offerId: offer.id,
      rideId: offer.rideId,
      pickup: ride.pickup,
      destination: ride.destination,
      distanceMeters: offer.distanceMeters,
      durationSeconds: offer.durationSeconds,
      routeConfidence: offer.routeConfidence,
      expiresAt: offer.expiresAt.toISOString()
    };
  }
}
