import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule, type TypeOrmModuleOptions } from "@nestjs/typeorm";

import { RefreshToken } from "../auth/entities/refresh-token.entity";
import type { EnvironmentVariables } from "../config/env.validation";
import { Driver } from "../drivers/entities/driver.entity";
import { RideOffer } from "../matching/entities/ride-offer.entity";
import { LedgerEntry } from "../payments/entities/ledger-entry.entity";
import { Payment } from "../payments/entities/payment.entity";
import { Wallet } from "../payments/entities/wallet.entity";
import { PricingSnapshot } from "../pricing/entities/pricing-snapshot.entity";
import { Ride } from "../rides/entities/ride.entity";
import { RideEvent } from "../rides/entities/ride-event.entity";
import { User } from "../users/entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>
      ): TypeOrmModuleOptions => ({
        type: "postgres",
        url: configService.get("DATABASE_URL", { infer: true }),
        ssl: configService.get("DATABASE_SSL", { infer: true }) === true,
        entities: [
          User,
          RefreshToken,
          Driver,
          Ride,
          RideEvent,
          RideOffer,
          PricingSnapshot,
          Wallet,
          Payment,
          LedgerEntry
        ],
        migrations: [],
        migrationsRun: false,
        synchronize: false,
        autoLoadEntities: false,
        logging: false
      })
    })
  ]
})
export class DatabaseModule {}
