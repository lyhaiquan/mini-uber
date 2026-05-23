import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { DriversModule } from "../drivers/drivers.module";
import { RedisModule } from "../infra/redis/redis.module";
import { DriverLocationCacheService } from "./cache/driver-location-cache.service";
import { LocationGateway } from "./gateways/location.gateway";
import { GpsJumpDetectionService } from "./jump/gps-jump-detection.service";

@Module({
  imports: [DriversModule, JwtModule.register({}), RedisModule],
  providers: [DriverLocationCacheService, GpsJumpDetectionService, LocationGateway],
  exports: [DriverLocationCacheService]
})
export class LocationModule {}

