import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import type { DomainEvent } from "../../common/domain-event";
import { RIDE_COMPLETED_EVENT } from "../../common/events/event-types";
import { StructuredLogger } from "../../common/logging/structured-logger";
import { PaymentProcessorService } from "../charge/payment-processor.service";
import { AUTO_RIDE_IDEMPOTENCY_PREFIX } from "../payments.constants";

const CONTEXT = "RideCompletedPaymentListener";

export interface RideCompletedPaymentPayload {
  rideId: string;
  customerId: string;
  driverUserId: string | null;
  completedAt: string;
}

export type RideCompletedPaymentEvent = DomainEvent<RideCompletedPaymentPayload>;

@Injectable()
export class RideCompletedPaymentListener {
  constructor(
    private readonly processor: PaymentProcessorService,
    private readonly logger: StructuredLogger
  ) {}

  @OnEvent(RIDE_COMPLETED_EVENT)
  async handle(event: RideCompletedPaymentEvent): Promise<void> {
    const rideId = event.aggregateId;
    try {
      await this.processor.processRideCompletion(
        rideId,
        `${AUTO_RIDE_IDEMPOTENCY_PREFIX}${rideId}`
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "payment.ride_completed.handler_failed",
          rideId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    }
  }
}
