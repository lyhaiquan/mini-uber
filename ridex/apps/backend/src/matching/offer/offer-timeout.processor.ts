import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";

import { StructuredLogger } from "../../common/logging/structured-logger";
import { MATCHING_OFFER_TIMEOUT_QUEUE } from "../matching.constants";
import type { OfferTimeoutJobPayload } from "../matching.types";
import { OfferOrchestratorService } from "./offer-orchestrator.service";

const CONTEXT = "OfferTimeoutProcessor";

@Injectable()
@Processor(MATCHING_OFFER_TIMEOUT_QUEUE)
export class OfferTimeoutProcessor extends WorkerHost {
  constructor(
    private readonly orchestrator: OfferOrchestratorService,
    private readonly logger: StructuredLogger
  ) {
    super();
  }

  override async process(job: Job<OfferTimeoutJobPayload>): Promise<void> {
    try {
      await this.orchestrator.handleTimeout(job.data.offerId);
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "matching.offer.timeout_job.failed",
          offerId: job.data.offerId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    }
  }
}

