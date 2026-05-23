import { Injectable } from "@nestjs/common";

import type { DriverAvailabilityDto } from "./dto/driver-availability.dto";
import { DriversService } from "./drivers.service";

export interface DriverPopulationStats {
  online: number;
  totalRegistered: number;
}

@Injectable()
export class DriversFacade {
  constructor(private readonly driversService: DriversService) {}

  async getDriverPopulation(): Promise<DriverPopulationStats> {
    const [online, totalRegistered] = await Promise.all([
      this.driversService.countOnline(),
      this.driversService.countTotal()
    ]);
    return { online, totalRegistered };
  }

  async setOnline(driverId: string, correlationId?: string): Promise<void> {
    await this.driversService.setOnline(driverId, correlationId);
  }

  async setOffline(driverId: string, correlationId?: string): Promise<void> {
    await this.driversService.setOffline(driverId, correlationId);
  }

  async isOnline(driverId: string): Promise<boolean> {
    return this.driversService.isOnline(driverId);
  }

  async getAvailability(driverId: string): Promise<DriverAvailabilityDto> {
    return this.driversService.getAvailability(driverId);
  }
}

