import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UsersModule } from "../users/users.module";
import { DriversController } from "./drivers.controller";
import { DriversFacade } from "./drivers.facade";
import { DriversService } from "./drivers.service";
import { Driver } from "./entities/driver.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Driver]), UsersModule],
  controllers: [DriversController],
  providers: [DriversService, DriversFacade],
  exports: [DriversFacade]
})
export class DriversModule {}

