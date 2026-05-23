import { Module } from "@nestjs/common";

import { GeoFacade } from "./geo.facade";
import { H3Service } from "./h3.service";
import { DriverLocationUpdatedGeoListener } from "./listeners/driver-location-updated.listener";
import { DriverWentOfflineGeoListener } from "./listeners/driver-went-offline.listener";
import { H3RedisIndexService } from "./redis/h3-redis-index.service";
import { StaleDriverSweeperService } from "./sweeper/stale-driver-sweeper.service";

@Module({
  providers: [
    H3Service,
    H3RedisIndexService,
    DriverLocationUpdatedGeoListener,
    DriverWentOfflineGeoListener,
    StaleDriverSweeperService,
    GeoFacade
  ],
  exports: [GeoFacade]
})
export class GeoModule {}
