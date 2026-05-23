import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { StructuredLogger } from "../../common/logging/structured-logger";
import {
  RIDE_REQUESTED_EVENT,
  type RideRequestedDomainEvent
} from "../../rides/events/ride-events";
import { OfferOrchestratorService } from "../offer/offer-orchestrator.service";

const CONTEXT = "RideRequestedMatchingListener";

@Injectable()
export class RideRequestedMatchingListener {
  constructor(
    private readonly orchestrator: OfferOrchestratorService,
    private readonly logger: StructuredLogger
  ) {}

  @OnEvent(RIDE_REQUESTED_EVENT)
  async handleRideRequested(event: RideRequestedDomainEvent): Promise<void> {
    try {
      await this.orchestrator.startMatching(event.aggregateId);
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "matching.ride_requested.failed",
          rideId: event.aggregateId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    }
  }
}

