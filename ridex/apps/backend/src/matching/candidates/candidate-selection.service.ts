import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { DriversFacade } from "../../drivers/drivers.facade";
import { GeoFacade } from "../../geo/geo.facade";
import { DriverLocationCacheService } from "../../location/cache/driver-location-cache.service";
import { RouteEstimator } from "../../routing/route-estimator";
import { CandidateScoringService } from "./candidate-scoring.service";
import type { MatchingCandidate, MatchingRide } from "../matching.types";
import { RideOfferRepository } from "../offer/ride-offer.repository";

const CONTEXT = "CandidateSelectionService";

@Injectable()
export class CandidateSelectionService {
  private readonly maxCandidates: number;
  private readonly discoveryMaxRing: number;
  private readonly distanceWeight: number;
  private readonly etaWeight: number;

  constructor(
    private readonly geoFacade: GeoFacade,
    private readonly driversFacade: DriversFacade,
    private readonly routeEstimator: RouteEstimator,
    private readonly locationCache: DriverLocationCacheService,
    private readonly offerRepository: RideOfferRepository,
    private readonly scoringService: CandidateScoringService,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.maxCandidates = configService.get("MATCHING_MAX_CANDIDATES", { infer: true });
    this.discoveryMaxRing = configService.get("MATCHING_DISCOVERY_MAX_RING", { infer: true });
    this.distanceWeight = configService.get("MATCHING_SCORE_DISTANCE_WEIGHT", { infer: true });
    this.etaWeight = configService.get("MATCHING_SCORE_ETA_WEIGHT", { infer: true });
  }

  async selectCandidates(ride: MatchingRide): Promise<MatchingCandidate[]> {
    const discovered = await this.geoFacade.findNearbyDrivers({
      lat: ride.pickup.lat,
      lng: ride.pickup.lng,
      maxRing: this.discoveryMaxRing
    });
    const attempted = new Set(await this.offerRepository.findAttemptedDriverIds(ride.id));
    const uniqueDriverIds = Array.from(new Set(discovered));
    const candidates: MatchingCandidate[] = [];

    for (const driverUserId of uniqueDriverIds) {
      if (driverUserId === ride.customerId || attempted.has(driverUserId)) {
        continue;
      }

      const candidate = await this.scoreDriver(driverUserId, ride);
      if (candidate !== null) {
        candidates.push(candidate);
      }
    }

    return candidates
      .sort((left, right) => left.score - right.score)
      .slice(0, this.maxCandidates);
  }

  private async scoreDriver(
    driverUserId: string,
    ride: MatchingRide
  ): Promise<MatchingCandidate | null> {
    if (!(await this.driversFacade.isOnline(driverUserId))) {
      return null;
    }

    if (await this.offerRepository.hasActiveOfferForDriver(driverUserId)) {
      return null;
    }

    const driverLocation = await this.locationCache.get(driverUserId);
    if (driverLocation === null) {
      return null;
    }

    try {
      const route = await this.routeEstimator.estimate({
        pickup: { lat: driverLocation.lat, lng: driverLocation.lng },
        destination: ride.pickup
      });
      const score = this.scoringService.score(
        {
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          confidence: route.confidence
        },
        {
          distanceWeight: this.distanceWeight,
          etaWeight: this.etaWeight
        }
      );

      return {
        driverUserId,
        score,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        routeConfidence: route.confidence
      };
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "matching.candidate.route_estimate_failed",
          driverUserId,
          rideId: ride.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return null;
    }
  }
}

