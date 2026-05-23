import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/env.validation";
import { BPS_DENOMINATOR } from "../payments.constants";
import type { FareSplit } from "../payments.types";

@Injectable()
export class FareSplitService {
  private readonly driverShareBps: number;
  private readonly platformShareBps: number;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.driverShareBps = configService.get("PAYMENT_DRIVER_SHARE_BPS", { infer: true });
    this.platformShareBps = configService.get("PAYMENT_PLATFORM_SHARE_BPS", { infer: true });
  }

  split(totalVnd: number): FareSplit {
    if (!Number.isInteger(totalVnd) || totalVnd < 0) {
      throw new Error(`Invalid payment total: ${totalVnd}`);
    }

    const driverShareVnd = Math.floor((totalVnd * this.driverShareBps) / BPS_DENOMINATOR);
    const platformShareVnd = totalVnd - driverShareVnd;

    return {
      driverShareVnd,
      platformShareVnd,
      driverShareBps: this.driverShareBps,
      platformShareBps: this.platformShareBps
    };
  }
}
