import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { RidesFacade } from "../../rides/rides.facade";
import { RideStatus } from "../../rides/enums/ride-status.enum";
import type { RouteEstimator } from "../../routing/route-estimator";
import type { CandidateSelectionService } from "../candidates/candidate-selection.service";
import { OfferStatus } from "../enums/offer-status.enum";
import { OfferNotForDriverError, OfferNotOfferableError } from "../errors/matching-errors";
import type { RideOffer } from "../entities/ride-offer.entity";
import type { OfferGateway } from "../gateways/offer.gateway";
import { RIDE_OFFER_ACCEPTED_EVENT, RIDE_OFFER_CREATED_EVENT } from "../matching.constants";
import type { MatchingCandidate } from "../matching.types";
import type { OfferTimeoutQueue } from "./offer-timeout.queue";
import { OfferOrchestratorService } from "./offer-orchestrator.service";
import type { RideOfferRepository } from "./ride-offer.repository";

const RIDE_ID = "ride-1";
const DRIVER_ID = "driver-1";
const OTHER_DRIVER_ID = "driver-2";
const OFFER_ID = "offer-1";

describe("OfferOrchestratorService", () => {
  it("starts matching, creates the first offer, emits, schedules, and pushes to driver", async () => {
    const { service, ridesFacade, offerRepository, timeoutQueue, offerGateway, eventEmitter } =
      createService();
    ridesFacade.getRideForMatching
      .mockResolvedValueOnce(ride(RideStatus.REQUESTED))
      .mockResolvedValueOnce(ride(RideStatus.MATCHING));

    await service.startMatching(RIDE_ID);

    expect(ridesFacade.markMatching).toHaveBeenCalledWith(RIDE_ID);
    expect(offerRepository.insertOffer).toHaveBeenCalledWith(
      expect.objectContaining({ rideId: RIDE_ID, driverUserId: DRIVER_ID, attemptNumber: 1 })
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      RIDE_OFFER_CREATED_EVENT,
      expect.objectContaining({ aggregateId: OFFER_ID })
    );
    expect(timeoutQueue.enqueue).toHaveBeenCalledWith(OFFER_ID, 15_000);
    expect(offerGateway.emitOfferReceived).toHaveBeenCalledWith(
      DRIVER_ID,
      expect.objectContaining({ offerId: OFFER_ID, tripDistanceMeters: 9000 })
    );
  });

  it("marks no drivers found when selection returns no candidates", async () => {
    const { service, candidateSelection, ridesFacade, offerRepository } = createService();
    candidateSelection.selectCandidates.mockResolvedValue([]);

    await service.startMatching(RIDE_ID);

    expect(ridesFacade.markNoDriversFound).toHaveBeenCalledWith(RIDE_ID, "no_candidates");
    expect(offerRepository.insertOffer).not.toHaveBeenCalled();
  });

  it("accepts an offer, assigns the driver, cancels timeout, and emits accepted", async () => {
    const { service, ridesFacade, offerRepository, timeoutQueue, eventEmitter } = createService();

    await service.handleAccept(OFFER_ID, DRIVER_ID);

    expect(offerRepository.transitionOfferStatus).toHaveBeenCalledWith(
      OFFER_ID,
      OfferStatus.OFFERED,
      OfferStatus.ACCEPTED
    );
    expect(ridesFacade.assignDriver).toHaveBeenCalledWith(RIDE_ID, DRIVER_ID);
    expect(timeoutQueue.cancel).toHaveBeenCalledWith(OFFER_ID);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      RIDE_OFFER_ACCEPTED_EVENT,
      expect.objectContaining({ aggregateId: OFFER_ID })
    );
  });

  it("rejects accept for already-finalized offers", async () => {
    const { service, offerRepository, ridesFacade } = createService({
      offer: offer({ status: OfferStatus.REJECTED })
    });

    await expect(service.handleAccept(OFFER_ID, DRIVER_ID)).rejects.toThrow(OfferNotOfferableError);
    expect(offerRepository.transitionOfferStatus).not.toHaveBeenCalled();
    expect(ridesFacade.assignDriver).not.toHaveBeenCalled();
  });

  it("rejects accept by another driver", async () => {
    const { service, offerRepository } = createService();

    await expect(service.handleAccept(OFFER_ID, OTHER_DRIVER_ID)).rejects.toThrow(
      OfferNotForDriverError
    );
    expect(offerRepository.transitionOfferStatus).not.toHaveBeenCalled();
  });

  it("turns a stale accept race into OfferNotOfferableError", async () => {
    const { service, offerRepository } = createService();
    offerRepository.transitionOfferStatus.mockResolvedValueOnce(null);

    await expect(service.handleAccept(OFFER_ID, DRIVER_ID)).rejects.toThrow(OfferNotOfferableError);
  });

  it("rejects an offer and retries the next candidate", async () => {
    const { service, offerRepository, timeoutQueue, ridesFacade, candidateSelection } = createService();
    offerRepository.countAttempts.mockResolvedValueOnce(1);
    candidateSelection.selectCandidates.mockResolvedValueOnce([
      {
        driverUserId: "driver-2",
        score: 0.2,
        distanceMeters: 2000,
        durationSeconds: 120,
        routeConfidence: "high"
      }
    ]);
    offerRepository.insertOffer.mockResolvedValueOnce(offer({ id: "offer-2", driverUserId: "driver-2", attemptNumber: 2 }));

    await service.handleReject(OFFER_ID, DRIVER_ID, "busy");

    expect(timeoutQueue.cancel).toHaveBeenCalledWith(OFFER_ID);
    expect(offerRepository.insertOffer).toHaveBeenCalledWith(
      expect.objectContaining({ driverUserId: "driver-2", attemptNumber: 2 })
    );
    expect(ridesFacade.markNoDriversFound).not.toHaveBeenCalled();
  });

  it("times out an offer and cancels the driver prompt", async () => {
    const { service, offerGateway } = createService();

    await service.handleTimeout(OFFER_ID);

    expect(offerGateway.emitOfferCancelled).toHaveBeenCalledWith(DRIVER_ID, {
      offerId: OFFER_ID,
      reason: "TIMED_OUT"
    });
  });

  it("does nothing when a timeout arrives for an already-finalized offer", async () => {
    const { service, offerRepository, offerGateway } = createService({
      offer: offer({ status: OfferStatus.ACCEPTED })
    });

    await service.handleTimeout(OFFER_ID);

    expect(offerRepository.transitionOfferStatus).not.toHaveBeenCalled();
    expect(offerGateway.emitOfferCancelled).not.toHaveBeenCalled();
  });

  it("cancels an accepted offer and rejects the ack if ride assignment fails", async () => {
    const { service, ridesFacade, offerRepository, offerGateway } = createService();
    ridesFacade.assignDriver.mockRejectedValue(new Error("cancelled"));

    await expect(service.handleAccept(OFFER_ID, DRIVER_ID)).rejects.toThrow(
      OfferNotOfferableError
    );

    expect(offerRepository.transitionOfferStatus).toHaveBeenCalledWith(
      OFFER_ID,
      OfferStatus.ACCEPTED,
      OfferStatus.CANCELLED
    );
    expect(offerGateway.emitOfferCancelled).toHaveBeenCalledWith(DRIVER_ID, {
      offerId: OFFER_ID,
      reason: "RIDE_CANCELLED"
    });
  });

  it("reports timeout_scheduling_failed when every candidate fails to enqueue", async () => {
    const { service, timeoutQueue, ridesFacade } = createService();
    timeoutQueue.enqueue.mockRejectedValue(new Error("redis down"));

    await service.startMatching(RIDE_ID);

    expect(ridesFacade.markNoDriversFound).toHaveBeenCalledWith(
      RIDE_ID,
      "timeout_scheduling_failed"
    );
  });

  it("cancels an active offer when the ride is no longer matching eligible", async () => {
    const { service, ridesFacade, offerGateway } = createService();
    ridesFacade.getRideForMatching.mockRejectedValue(new Error("cancelled"));

    await service.tryNextCandidate(RIDE_ID);

    expect(offerGateway.emitOfferCancelled).toHaveBeenCalledWith(DRIVER_ID, {
      offerId: OFFER_ID,
      reason: "RIDE_CANCELLED"
    });
  });

  it("compensates timeout scheduling failures and does not leak an active offer", async () => {
    const { service, timeoutQueue, offerRepository } = createService();
    timeoutQueue.enqueue.mockRejectedValue(new Error("redis down"));

    await service.startMatching(RIDE_ID);

    expect(offerRepository.transitionOfferStatus).toHaveBeenCalledWith(
      OFFER_ID,
      OfferStatus.OFFERED,
      OfferStatus.CANCELLED
    );
  });
});

function createService(options: { offer?: RideOffer } = {}): {
  service: OfferOrchestratorService;
  ridesFacade: jest.Mocked<RidesFacade>;
  candidateSelection: jest.Mocked<CandidateSelectionService>;
  offerRepository: jest.Mocked<RideOfferRepository>;
  timeoutQueue: jest.Mocked<OfferTimeoutQueue>;
  offerGateway: jest.Mocked<OfferGateway>;
  eventEmitter: jest.Mocked<EventEmitter2>;
} {
  const currentOffer = options.offer ?? offer();
  const ridesFacade = {
    getRideForMatching: jest.fn().mockResolvedValue(ride(RideStatus.MATCHING)),
    markMatching: jest.fn(),
    assignDriver: jest.fn(),
    markNoDriversFound: jest.fn()
  } as unknown as jest.Mocked<RidesFacade>;
  const candidateSelection = {
    selectCandidates: jest.fn().mockImplementation(async () => candidates())
  } as unknown as jest.Mocked<CandidateSelectionService>;
  const offerRepository = {
    insertOffer: jest.fn().mockImplementation(async (input: Partial<RideOffer>) =>
      offer({
        id: input.driverUserId === "driver-2" ? "offer-2" : OFFER_ID,
        driverUserId: input.driverUserId ?? DRIVER_ID,
        attemptNumber: input.attemptNumber ?? 1
      })
    ),
    findById: jest.fn().mockResolvedValue(currentOffer),
    findActiveOfferForRide: jest.fn().mockResolvedValue(currentOffer),
    countAttempts: jest.fn().mockResolvedValue(0),
    findAttemptedDriverIds: jest.fn().mockResolvedValue([]),
    transitionOfferStatus: jest.fn().mockImplementation(async (_id, _from, toStatus: OfferStatus) =>
      offer({ ...currentOffer, status: toStatus })
    )
  } as unknown as jest.Mocked<RideOfferRepository>;
  const timeoutQueue = {
    enqueue: jest.fn(),
    cancel: jest.fn()
  } as unknown as jest.Mocked<OfferTimeoutQueue>;
  const routeEstimator = {
    estimate: jest.fn().mockResolvedValue({
      distanceMeters: 9000,
      durationSeconds: 1200,
      confidence: "high",
      source: "osrm",
      polyline: null,
      polylineFormat: null
    })
  } as unknown as jest.Mocked<RouteEstimator>;
  const offerGateway = {
    emitOfferReceived: jest.fn(),
    emitOfferCancelled: jest.fn()
  } as unknown as jest.Mocked<OfferGateway>;
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;
  const logger = {
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      const values: Partial<EnvironmentVariables> = {
        MATCHING_MAX_CANDIDATES: 5,
        MATCHING_OFFER_TIMEOUT_SECONDS: 15
      };
      return values[key];
    })
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return {
    service: new OfferOrchestratorService(
      ridesFacade,
      candidateSelection,
      offerRepository,
      timeoutQueue,
      routeEstimator,
      offerGateway,
      eventEmitter,
      logger,
      configService
    ),
    ridesFacade,
    candidateSelection,
    offerRepository,
    timeoutQueue,
    offerGateway,
    eventEmitter
  };
}

function ride(status: RideStatus): {
  id: string;
  customerId: string;
  driverUserId: string | null;
  status: RideStatus;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  version: number;
} {
  return {
    id: RIDE_ID,
    customerId: "customer-1",
    driverUserId: null,
    status,
    pickup: { lat: 10, lng: 106 },
    destination: { lat: 11, lng: 107 },
    version: 0
  };
}

function offer(overrides: Partial<RideOffer> = {}): RideOffer {
  return {
    id: OFFER_ID,
    rideId: RIDE_ID,
    driverUserId: DRIVER_ID,
    status: OfferStatus.OFFERED,
    attemptNumber: 1,
    score: 0.1,
    distanceMeters: 1000,
    durationSeconds: 60,
    routeConfidence: "high",
    offeredAt: new Date("2026-05-17T00:00:00.000Z"),
    expiresAt: new Date("2026-05-17T00:00:15.000Z"),
    respondedAt: null,
    finalizedAt: null,
    version: 0,
    ...overrides
  };
}

function candidates(): MatchingCandidate[] {
  return [
    {
      driverUserId: DRIVER_ID,
      score: 0.1,
      distanceMeters: 1000,
      durationSeconds: 60,
      routeConfidence: "high"
    },
    {
      driverUserId: "driver-2",
      score: 0.2,
      distanceMeters: 2000,
      durationSeconds: 120,
      routeConfidence: "high"
    }
  ];
}
