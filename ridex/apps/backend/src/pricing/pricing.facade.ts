import { Injectable } from "@nestjs/common";

import { GeoFacade } from "../geo/geo.facade";
import { RouteEstimator } from "../routing/route-estimator";
import { PricingSnapshot } from "./entities/pricing-snapshot.entity";
import { FareCalculatorService } from "./fare/fare-calculator.service";
import { CURRENCY_VND } from "./pricing.constants";
import type { ComputePricingInput, PricingEstimate } from "./pricing.types";
import { PricingSnapshotRepository } from "./snapshot/pricing-snapshot.repository";
import { SurgeService } from "./surge/surge.service";

@Injectable()
export class PricingFacade {
  constructor(
    private readonly snapshotRepository: PricingSnapshotRepository,
    private readonly geoFacade: GeoFacade,
    private readonly routeEstimator: RouteEstimator,
    private readonly surgeService: SurgeService,
    private readonly fareCalculator: FareCalculatorService
  ) {}

  async getSnapshotForRide(rideId: string): Promise<PricingSnapshot | null> {
    return this.snapshotRepository.findByRideId(rideId);
  }

  async computeFareEstimate(input: ComputePricingInput): Promise<PricingEstimate> {
    const cells = this.geoFacade.cellsForLocation(input.pickup.lat, input.pickup.lng);
    const route = await this.routeEstimator.estimate({
      pickup: input.pickup,
      destination: input.destination
    });
    const surge = await this.surgeService.getMultiplier(cells.r8);
    const breakdown = this.fareCalculator.compute({
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      surgeMultiplier: surge.multiplier,
      routeConfidence: route.confidence
    });

    return {
      ...breakdown,
      currency: CURRENCY_VND,
      pickupH3R8: cells.r8,
      surge
    };
  }
}
