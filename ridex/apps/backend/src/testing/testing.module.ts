import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { DriversModule } from "../drivers/drivers.module";
import { Driver } from "../drivers/entities/driver.entity";
import { LocationModule } from "../location/location.module";
import { RideOffer } from "../matching/entities/ride-offer.entity";
import { RidesModule } from "../rides/rides.module";
import { User } from "../users/entities/user.entity";
import { UsersModule } from "../users/users.module";
import { E2ESeedController } from "./e2e-seed.controller";
import { E2ESeedService } from "./e2e-seed.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Driver, RideOffer]),
    AuthModule,
    UsersModule,
    DriversModule,
    LocationModule,
    RidesModule
  ],
  controllers: [E2ESeedController],
  providers: [E2ESeedService]
})
export class TestingModule {}
