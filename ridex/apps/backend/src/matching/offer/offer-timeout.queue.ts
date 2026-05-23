import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

import {
  MATCHING_OFFER_TIMEOUT_JOB_NAME,
  MATCHING_OFFER_TIMEOUT_QUEUE
} from "../matching.constants";
import type { OfferTimeoutJobPayload } from "../matching.types";

@Injectable()
export class OfferTimeoutQueue {
  constructor(
    @InjectQueue(MATCHING_OFFER_TIMEOUT_QUEUE)
    private readonly queue: Queue<OfferTimeoutJobPayload>
  ) {}

  async enqueue(offerId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      MATCHING_OFFER_TIMEOUT_JOB_NAME,
      { offerId },
      {
        delay: delayMs,
        jobId: this.jobId(offerId),
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true
      }
    );
  }

  async cancel(offerId: string): Promise<void> {
    const job = await this.queue.getJob(this.jobId(offerId));
    if (job !== undefined && job !== null) {
      await (job as Job<OfferTimeoutJobPayload>).remove();
    }
  }

  jobId(offerId: string): string {
    return `offer-timeout:${offerId}`;
  }
}

