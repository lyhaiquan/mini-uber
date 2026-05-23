import { Module } from "@nestjs/common";

import { OsrmClient } from "./osrm/osrm.client";
import { RouteEstimator } from "./route-estimator";

@Module({
  providers: [OsrmClient, RouteEstimator],
  exports: [RouteEstimator]
})
export class RoutingModule {}

