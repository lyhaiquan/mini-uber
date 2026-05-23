import type { Job } from "bullmq";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { OfferTimeoutJobPayload } from "../matching.types";
import type { OfferOrchestratorService } from "./offer-orchestrator.service";
import { OfferTimeoutProcessor } from "./offer-timeout.processor";

describe("OfferTimeoutProcessor", () => {
  it("delegates timeout jobs to the orchestrator", async () => {
    const { processor, orchestrator } = createProcessor();

    await processor.process({ data: { offerId: "offer-1" } } as Job<OfferTimeoutJobPayload>);

    expect(orchestrator.handleTimeout).toHaveBeenCalledWith("offer-1");
  });

  it("swallows handler failures and logs them", async () => {
    const { processor, orchestrator, logger } = createProcessor();
    orchestrator.handleTimeout.mockRejectedValue(new Error("boom"));

    await expect(
      processor.process({ data: { offerId: "offer-1" } } as Job<OfferTimeoutJobPayload>)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "matching.offer.timeout_job.failed" }),
      expect.any(String),
      "OfferTimeoutProcessor"
    );
  });
});

function createProcessor(): {
  processor: OfferTimeoutProcessor;
  orchestrator: jest.Mocked<OfferOrchestratorService>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const orchestrator = {
    handleTimeout: jest.fn()
  } as unknown as jest.Mocked<OfferOrchestratorService>;
  const logger = {
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;

  return {
    processor: new OfferTimeoutProcessor(orchestrator, logger),
    orchestrator,
    logger
  };
}

