import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { RideRequestedDomainEvent } from "../../rides/events/ride-events";
import type { OfferOrchestratorService } from "../offer/offer-orchestrator.service";
import { RideRequestedMatchingListener } from "./ride-requested.listener";

describe("RideRequestedMatchingListener", () => {
  it("starts matching for ride.requested events", async () => {
    const { listener, orchestrator } = createListener();

    await listener.handleRideRequested(event());

    expect(orchestrator.startMatching).toHaveBeenCalledWith("ride-1");
  });

  it("logs orchestrator failures without bubbling", async () => {
    const { listener, orchestrator, logger } = createListener();
    orchestrator.startMatching.mockRejectedValue(new Error("boom"));

    await expect(listener.handleRideRequested(event())).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "matching.ride_requested.failed" }),
      expect.any(String),
      "RideRequestedMatchingListener"
    );
  });
});

function createListener(): {
  listener: RideRequestedMatchingListener;
  orchestrator: jest.Mocked<OfferOrchestratorService>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const orchestrator = {
    startMatching: jest.fn()
  } as unknown as jest.Mocked<OfferOrchestratorService>;
  const logger = {
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;

  return {
    listener: new RideRequestedMatchingListener(orchestrator, logger),
    orchestrator,
    logger
  };
}

function event(): RideRequestedDomainEvent {
  return {
    eventId: "event-1",
    eventType: "ride.requested",
    aggregateType: "ride",
    aggregateId: "ride-1",
    payload: {
      customerId: "customer-1",
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 11, lng: 107 },
      requestedAt: "2026-05-17T00:00:00.000Z"
    },
    correlationId: "correlation-1",
    occurredAt: "2026-05-17T00:00:00.000Z",
    emittedBy: "rides"
  };
}

