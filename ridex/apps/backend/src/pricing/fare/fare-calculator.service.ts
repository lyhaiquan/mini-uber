import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/env.validation";
import { SURGE_MILLI_SCALE } from "../pricing.constants";
import { InvalidPricingInputError } from "../errors/pricing-errors";
import type { ComputeFareInput, FareBreakdown, FareCalculatorConfig } from "../pricing.types";

@Injectable()
export class FareCalculatorService {
  private readonly config: FareCalculatorConfig;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.config = {
      baseFareVnd: configService.get("PRICING_BASE_FARE_VND", { infer: true }),
      perKmVnd: configService.get("PRICING_PER_KM_VND", { infer: true }),
      perMinVnd: configService.get("PRICING_PER_MIN_VND", { infer: true }),
      minimumFareVnd: configService.get("PRICING_MINIMUM_FARE_VND", { infer: true })
    };
  }

  compute(input: ComputeFareInput): FareBreakdown {
    this.assertValidInput(input);

    const distanceFeeVnd = Math.floor(
      (input.distanceMeters * this.config.perKmVnd) / 1000
    );
    const durationFeeVnd = Math.floor(
      (input.durationSeconds * this.config.perMinVnd) / 60
    );
    const subtotalVnd = this.config.baseFareVnd + distanceFeeVnd + durationFeeVnd;

    const surgeMilli = Math.floor(input.surgeMultiplier * SURGE_MILLI_SCALE + 1e-9);
    const surgeAmountVnd = Math.floor(
      (subtotalVnd * (surgeMilli - SURGE_MILLI_SCALE)) / SURGE_MILLI_SCALE
    );

    const totalBeforeMinimum = subtotalVnd + surgeAmountVnd;
    const totalVnd = Math.max(totalBeforeMinimum, this.config.minimumFareVnd);

    return {
      baseFareVnd: this.config.baseFareVnd,
      distanceMeters: input.distanceMeters,
      distanceFeeVnd,
      durationSeconds: input.durationSeconds,
      durationFeeVnd,
      subtotalVnd,
      surgeMultiplier: surgeMilli / SURGE_MILLI_SCALE,
      surgeAmountVnd: Math.max(surgeAmountVnd, 0),
      minimumFareVnd: this.config.minimumFareVnd,
      totalVnd,
      routeConfidence: input.routeConfidence
    };
  }

  private assertValidInput(input: ComputeFareInput): void {
    if (!Number.isFinite(input.distanceMeters) || input.distanceMeters < 0) {
      throw new InvalidPricingInputError(`distanceMeters: ${input.distanceMeters}`);
    }
    if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
      throw new InvalidPricingInputError(`durationSeconds: ${input.durationSeconds}`);
    }
    if (!Number.isFinite(input.surgeMultiplier) || input.surgeMultiplier < 1) {
      throw new InvalidPricingInputError(`surgeMultiplier: ${input.surgeMultiplier}`);
    }
  }
}
