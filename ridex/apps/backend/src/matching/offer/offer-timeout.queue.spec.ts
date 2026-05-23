import type { Queue } from "bullmq";

import {
  MATCHING_OFFER_TIMEOUT_JOB_NAME
} from "../matching.constants";
import type { OfferTimeoutJobPayload } from "../matching.types";
import { OfferTimeoutQueue } from "./offer-timeout.queue";

describe("OfferTimeoutQueue", () => {
  it("enqueues deterministic delayed timeout jobs with one attempt", async () => {
    const queue = {
      add: jest.fn(),
      getJob: jest.fn()
    } as unknown as jest.Mocked<Queue<OfferTimeoutJobPayload>>;
    const service = new OfferTimeoutQueue(queue);

    await service.enqueue("offer-1", 15_000);

    expect(queue.add).toHaveBeenCalledWith(
      MATCHING_OFFER_TIMEOUT_JOB_NAME,
      { offerId: "offer-1" },
      expect.objectContaining({
        delay: 15_000,
        jobId: "offer-timeout:offer-1",
        attempts: 1
      })
    );
  });

  it("removes an existing timeout job on cancel", async () => {
    const job = { remove: jest.fn() };
    const queue = {
      add: jest.fn(),
      getJob: jest.fn().mockResolvedValue(job)
    } as unknown as jest.Mocked<Queue<OfferTimeoutJobPayload>>;
    const service = new OfferTimeoutQueue(queue);

    await service.cancel("offer-1");

    expect(queue.getJob).toHaveBeenCalledWith("offer-timeout:offer-1");
    expect(job.remove).toHaveBeenCalledTimes(1);
  });
});

