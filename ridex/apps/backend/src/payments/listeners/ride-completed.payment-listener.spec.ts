import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { PaymentProcessorService } from "../charge/payment-processor.service";
import {
  RideCompletedPaymentListener,
  type RideCompletedPaymentEvent
} from "./ride-completed.payment-listener";

const RIDE_ID = "ride-1";

describe("RideCompletedPaymentListener", () => {
  it("routes ride.completed events to the payment processor", async () => {
    const { listener, processor } = createListener();

    await listener.handle(event());

    expect(processor.processRideCompletion).toHaveBeenCalledWith(
      RIDE_ID,
      `auto:ride:${RIDE_ID}`
    );
  });

  it("swallows processor errors and logs them", async () => {
    const { listener, processor, logger } = createListener();
    processor.processRideCompletion.mockRejectedValue(new Error("boom"));

    await expect(listener.handle(event())).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "payment.ride_completed.handler_failed", rideId: RIDE_ID }),
      expect.any(String),
      "RideCompletedPaymentListener"
    );
  });

  it("uses aggregateId as the canonical ride id", async () => {
    const { listener, processor } = createListener();
    const payloadMismatch = event();
    payloadMismatch.payload.rideId = "spoofed";

    await listener.handle(payloadMismatch);

    expect(processor.processRideCompletion).toHaveBeenCalledWith(
      RIDE_ID,
      `auto:ride:${RIDE_ID}`
    );
  });
});

function createListener(): {
  listener: RideCompletedPaymentListener;
  processor: jest.Mocked<PaymentProcessorService>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const processor = {
    processRideCompletion: jest.fn()
  } as unknown as jest.Mocked<PaymentProcessorService>;
  const logger = {
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  return {
    listener: new RideCompletedPaymentListener(processor, logger),
    processor,
    logger
  };
}

function event(): RideCompletedPaymentEvent {
  return {
    eventId: "event-1",
    eventType: "ride.completed",
    aggregateType: "ride",
    aggregateId: RIDE_ID,
    payload: {
      rideId: RIDE_ID,
      customerId: "customer-1",
      driverUserId: "driver-1",
      completedAt: "2026-05-17T00:00:00.000Z"
    },
    correlationId: "corr-1",
    occurredAt: "2026-05-17T00:00:00.000Z",
    emittedBy: "rides"
  };
}
