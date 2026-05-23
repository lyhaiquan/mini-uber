import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import type { RouteConfidence } from "../../routing/routing.types";
import { PricingSnapshot } from "../entities/pricing-snapshot.entity";
import type { FareBreakdown } from "../pricing.types";

export interface InsertSnapshotInput extends FareBreakdown {
  rideId: string;
  pickupH3R8: string;
  routeConfidence: RouteConfidence;
}

@Injectable()
export class PricingSnapshotRepository {
  constructor(
    @InjectRepository(PricingSnapshot)
    private readonly repository: Repository<PricingSnapshot>
  ) {}

  async insert(input: InsertSnapshotInput): Promise<PricingSnapshot> {
    const snapshot = this.repository.create({
      rideId: input.rideId,
      currency: "VND",
      pickupH3R8: input.pickupH3R8,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      routeConfidence: input.routeConfidence,
      baseFareVnd: input.baseFareVnd,
      distanceFeeVnd: input.distanceFeeVnd,
      durationFeeVnd: input.durationFeeVnd,
      subtotalVnd: input.subtotalVnd,
      surgeMultiplier: input.surgeMultiplier,
      surgeAmountVnd: input.surgeAmountVnd,
      minimumFareVnd: input.minimumFareVnd,
      totalVnd: input.totalVnd,
      computedAt: new Date(),
      version: 0
    });
    return this.repository.save(snapshot);
  }

  async findByRideId(rideId: string): Promise<PricingSnapshot | null> {
    return this.repository.findOne({ where: { rideId } });
  }
}
