import { DataSource } from "typeorm";

import { RefreshToken } from "../auth/entities/refresh-token.entity";
import { Driver } from "../drivers/entities/driver.entity";
import { RideOffer } from "../matching/entities/ride-offer.entity";
import { LedgerEntry } from "../payments/entities/ledger-entry.entity";
import { Payment } from "../payments/entities/payment.entity";
import { Wallet } from "../payments/entities/wallet.entity";
import { PricingSnapshot } from "../pricing/entities/pricing-snapshot.entity";
import { Ride } from "../rides/entities/ride.entity";
import { RideEvent } from "../rides/entities/ride-event.entity";
import { User } from "../users/entities/user.entity";
import { CreateUsersTable1747200000000 } from "./migrations/1747200000000-CreateUsersTable";
import { CreateRefreshTokensTable1747200001000 } from "./migrations/1747200001000-CreateRefreshTokensTable";
import { CreateRidesTables1747200002000 } from "./migrations/1747200002000-CreateRidesTables";
import { CreateDriversTable1747200003000 } from "./migrations/1747200003000-CreateDriversTable";
import { CreateRideOffersTable1778950800000 } from "./migrations/1778950800000-CreateRideOffersTable";
import { CreatePricingSnapshotsTable1778950900000 } from "./migrations/1778950900000-CreatePricingSnapshotsTable";
import { CreateWalletsAndPaymentsTables1778951000000 } from "./migrations/1778951000000-CreateWalletsAndPaymentsTables";
import { SeedAdminUser1778951100000 } from "./migrations/1778951100000-SeedAdminUser";

const databaseUrl = process.env.DATABASE_URL;

if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
  throw new Error(
    "DATABASE_URL is required to run TypeORM CLI. " +
      "Set it via shell or use: node --env-file=.env -r ts-node/register ..."
  );
}

export const dataSource = new DataSource({
  type: "postgres",
  url: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true",
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
  migrations: [
    CreateUsersTable1747200000000,
    CreateRefreshTokensTable1747200001000,
    CreateRidesTables1747200002000,
    CreateDriversTable1747200003000,
    CreateRideOffersTable1778950800000,
    CreatePricingSnapshotsTable1778950900000,
    CreateWalletsAndPaymentsTables1778951000000,
    SeedAdminUser1778951100000
  ],
  migrationsTableName: "migrations"
});
