import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";

import type { DomainEvent } from "../../common/domain-event";
import { AUTH_USER_CREATED_EVENT } from "../../common/events/event-types";
import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { Role } from "../../users/dto/role.enum";
import { WalletKind } from "../enums/wallet-kind.enum";
import type { AuthUserCreatedPayload } from "../payments.types";
import { WalletRepository } from "../wallet/wallet.repository";

const CONTEXT = "UserCreatedWalletSeeder";

export type AuthUserCreatedEvent = DomainEvent<AuthUserCreatedPayload>;

@Injectable()
export class UserCreatedWalletSeeder {
  private readonly seedVnd: number;

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.seedVnd = configService.get("PAYMENT_WALLET_SEED_VND", { infer: true });
  }

  @OnEvent(AUTH_USER_CREATED_EVENT)
  async handle(event: AuthUserCreatedEvent): Promise<void> {
    const kind = event.payload.role === Role.DRIVER ? WalletKind.DRIVER : WalletKind.CUSTOMER;
    try {
      await this.walletRepository.findOrCreateForUser(
        event.payload.userId,
        kind,
        this.seedVnd
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "payment.wallet_seed.failed",
          userId: event.payload.userId,
          kind,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    }
  }
}
