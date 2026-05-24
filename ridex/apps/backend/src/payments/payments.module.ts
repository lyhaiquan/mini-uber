import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { PricingModule } from "../pricing/pricing.module";
import { RidesModule } from "../rides/rides.module";
import { PaymentProcessorService } from "./charge/payment-processor.service";
import { FareSplitService } from "./charge/fare-split.service";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { Payment } from "./entities/payment.entity";
import { Wallet } from "./entities/wallet.entity";
import { LedgerRepository } from "./ledger/ledger.repository";
import { RideCompletedPaymentListener } from "./listeners/ride-completed.payment-listener";
import { UserCreatedWalletSeeder } from "./listeners/user-created.wallet-seeder";
import { PaymentRepository } from "./payment/payment.repository";
import { PaymentsFacade } from "./payments.facade";
import { PaymentsMeController } from "./payments.me.controller";
import { WalletRepository } from "./wallet/wallet.repository";

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Payment, LedgerEntry]), RidesModule, PricingModule],
  controllers: [PaymentsMeController],
  providers: [
    FareSplitService,
    PaymentProcessorService,
    WalletRepository,
    PaymentRepository,
    LedgerRepository,
    RideCompletedPaymentListener,
    UserCreatedWalletSeeder,
    PaymentsFacade
  ],
  exports: [PaymentsFacade]
})
export class PaymentsModule {}
