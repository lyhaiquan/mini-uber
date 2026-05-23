import { randomUUID } from "node:crypto";

import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { DomainEvent } from "../../common/domain-event";
import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { RidesFacade } from "../../rides/rides.facade";
import { RideStatus } from "../../rides/enums/ride-status.enum";
import { RouteEstimator } from "../../routing/route-estimator";
import { OfferStatus } from "../enums/offer-status.enum";
import {
  OfferNotForDriverError,
  OfferNotFoundError,
  OfferNotOfferableError
} from "../errors/matching-errors";
import {
  RIDE_MATCHING_NO_DRIVERS_EVENT,
  RIDE_MATCHING_STARTED_EVENT,
  RIDE_OFFER_ACCEPTED_EVENT,
  RIDE_OFFER_CANCELLED_EVENT,
  RIDE_OFFER_CREATED_EVENT,
  RIDE_OFFER_EXPIRED_EVENT,
  RIDE_OFFER_REJECTED_EVENT
} from "../matching.constants";
import type {
  MatchingCandidate,
  MatchingRide,
  OfferCancellationReason,
  OfferReceivedPayload
} from "../matching.types";
import { CandidateSelectionService } from "../candidates/candidate-selection.service";
import { OfferGateway } from "../gateways/offer.gateway";
import { RideOffer } from "../entities/ride-offer.entity";
import { RideOfferRepository } from "./ride-offer.repository";
import { OfferTimeoutQueue } from "./offer-timeout.queue";

const CONTEXT = "OfferOrchestratorService";

@Injectable()
export class OfferOrchestratorService {
  private readonly maxCandidates: number;
  private readonly offerTimeoutMs: number;

  constructor(
    private readonly ridesFacade: RidesFacade,
    private readonly candidateSelection: CandidateSelectionService,
    private readonly offerRepository: RideOfferRepository,
    private readonly timeoutQueue: OfferTimeoutQueue,
    private readonly routeEstimator: RouteEstimator,
    @Inject(forwardRef(() => OfferGateway))
    private readonly offerGateway: OfferGateway,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.maxCandidates = configService.get("MATCHING_MAX_CANDIDATES", { infer: true });
    this.offerTimeoutMs =
      configService.get("MATCHING_OFFER_TIMEOUT_SECONDS", { infer: true }) * 1000;
  }

  async startMatching(rideId: string): Promise<void> {
    let ride = await this.getMatchingRideOrLog(rideId);
    if (ride === null) {
      return;
    }

    if (ride.status === RideStatus.REQUESTED) {
      try {
        await this.ridesFacade.markMatching(rideId);
        this.emitRideEvent(RIDE_MATCHING_STARTED_EVENT, rideId, { rideId });
      } catch (error: unknown) {
        this.logger.warn(
          {
            event: "matching.ride.mark_matching_failed",
            rideId,
            errorName: error instanceof Error ? error.name : "UnknownError"
          },
          CONTEXT
        );
        return;
      }
      ride = await this.getMatchingRideOrLog(rideId);
      if (ride === null) {
        return;
      }
    }

    await this.tryNextCandidate(ride.id);
  }

  async handleAccept(offerId: string, driverUserId: string): Promise<void> {
    const offer = await this.getOfferForDriverAction(offerId, driverUserId);
    const acceptedOffer = await this.offerRepository.transitionOfferStatus(
      offer.id,
      OfferStatus.OFFERED,
      OfferStatus.ACCEPTED
    );
    if (acceptedOffer === null) {
      throw new OfferNotOfferableError(offerId);
    }

    try {
      await this.ridesFacade.assignDriver(offer.rideId, driverUserId);
    } catch (error: unknown) {
      await this.offerRepository.transitionOfferStatus(
        offer.id,
        OfferStatus.ACCEPTED,
        OfferStatus.CANCELLED
      );
      this.emitOfferCancelled(offer, "RIDE_CANCELLED");
      this.logger.warn(
        {
          event: "matching.offer.accept_ride_transition_failed",
          offerId,
          rideId: offer.rideId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      throw new OfferNotOfferableError(offerId);
    }

    await this.timeoutQueue.cancel(offer.id);
    this.emitOfferEvent(RIDE_OFFER_ACCEPTED_EVENT, acceptedOffer);
  }

  async handleReject(offerId: string, driverUserId: string, reason?: string): Promise<void> {
    const offer = await this.getOfferForDriverAction(offerId, driverUserId);
    const rejectedOffer = await this.offerRepository.transitionOfferStatus(
      offer.id,
      OfferStatus.OFFERED,
      OfferStatus.REJECTED
    );
    if (rejectedOffer === null) {
      throw new OfferNotOfferableError(offerId);
    }

    await this.timeoutQueue.cancel(offer.id);
    this.emitOfferEvent(RIDE_OFFER_REJECTED_EVENT, rejectedOffer, { reason: reason ?? null });
    await this.tryNextCandidate(offer.rideId);
  }

  async handleTimeout(offerId: string): Promise<void> {
    const offer = await this.offerRepository.findById(offerId);
    if (offer === null || offer.status !== OfferStatus.OFFERED) {
      return;
    }

    const timedOutOffer = await this.offerRepository.transitionOfferStatus(
      offer.id,
      OfferStatus.OFFERED,
      OfferStatus.TIMED_OUT
    );
    if (timedOutOffer === null) {
      return;
    }

    this.emitOfferEvent(RIDE_OFFER_EXPIRED_EVENT, timedOutOffer);
    this.emitOfferCancelled(timedOutOffer, "TIMED_OUT");
    await this.tryNextCandidate(offer.rideId);
  }

  async tryNextCandidate(rideId: string): Promise<void> {
    const rideSummary = await this.getMatchingRideOrLog(rideId);
    if (rideSummary === null) {
      await this.cancelActiveOffer(rideId, "RIDE_CANCELLED");
      return;
    }

    if (rideSummary.status !== RideStatus.MATCHING) {
      return;
    }

    const attempts = await this.offerRepository.countAttempts(rideId);
    if (attempts >= this.maxCandidates) {
      await this.noDriversFound(rideId, "exhausted");
      return;
    }

    const ride: MatchingRide = {
      id: rideSummary.id,
      customerId: rideSummary.customerId,
      pickup: rideSummary.pickup,
      destination: rideSummary.destination
    };
    const candidates = await this.candidateSelection.selectCandidates(ride);

    if (candidates.length === 0) {
      await this.noDriversFound(rideId, "no_candidates");
      return;
    }

    let attemptNumber = attempts + 1;
    let anyEnqueueFailed = false;
    for (const candidate of candidates) {
      if (attemptNumber > this.maxCandidates) {
        await this.noDriversFound(rideId, "exhausted");
        return;
      }

      const result = await this.offerCandidate(ride, candidate, attemptNumber);
      if (result === "offered") {
        return;
      }
      if (result === "enqueue_failed") {
        anyEnqueueFailed = true;
      }
      attemptNumber += 1;
    }

    await this.noDriversFound(
      rideId,
      anyEnqueueFailed ? "timeout_scheduling_failed" : "no_candidates"
    );
  }

  private async offerCandidate(
    ride: MatchingRide,
    candidate: MatchingCandidate,
    attemptNumber: number
  ): Promise<"offered" | "insert_failed" | "enqueue_failed"> {
    const expiresAt = new Date(Date.now() + this.offerTimeoutMs);
    let offer: RideOffer;

    try {
      offer = await this.offerRepository.insertOffer({
        ...candidate,
        rideId: ride.id,
        attemptNumber,
        expiresAt
      });
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "matching.offer.insert_failed",
          rideId: ride.id,
          driverUserId: candidate.driverUserId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return "insert_failed";
    }

    this.emitOfferEvent(RIDE_OFFER_CREATED_EVENT, offer);
    this.offerGateway.emitOfferReceived(
      offer.driverUserId,
      await this.createOfferPayload(ride, offer)
    );

    try {
      await this.timeoutQueue.enqueue(offer.id, this.offerTimeoutMs);
      return "offered";
    } catch (error: unknown) {
      await this.offerRepository.transitionOfferStatus(
        offer.id,
        OfferStatus.OFFERED,
        OfferStatus.CANCELLED
      );
      this.emitOfferCancelled(offer, "TIMEOUT_SCHEDULING_FAILED");
      this.logger.error(
        {
          event: "matching.offer.timeout_enqueue_failed",
          offerId: offer.id,
          rideId: ride.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
      return "enqueue_failed";
    }
  }

  private async createOfferPayload(
    ride: MatchingRide,
    offer: RideOffer
  ): Promise<OfferReceivedPayload> {
    const payload: OfferReceivedPayload = {
      offerId: offer.id,
      rideId: ride.id,
      pickup: ride.pickup,
      destination: ride.destination,
      distanceMeters: offer.distanceMeters,
      durationSeconds: offer.durationSeconds,
      expiresAt: offer.expiresAt.toISOString(),
      routeConfidence: offer.routeConfidence
    };

    try {
      const tripEstimate = await this.routeEstimator.estimate({
        pickup: ride.pickup,
        destination: ride.destination
      });
      payload.tripDistanceMeters = tripEstimate.distanceMeters;
      payload.tripDurationSeconds = tripEstimate.durationSeconds;
      payload.tripRouteConfidence = tripEstimate.confidence;
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "matching.offer.trip_estimate_failed",
          offerId: offer.id,
          rideId: ride.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }

    return payload;
  }

  private async getOfferForDriverAction(
    offerId: string,
    driverUserId: string
  ): Promise<RideOffer> {
    const offer = await this.offerRepository.findById(offerId);
    if (offer === null) {
      throw new OfferNotFoundError(offerId);
    }
    if (offer.driverUserId !== driverUserId) {
      throw new OfferNotForDriverError(offerId);
    }
    if (offer.status !== OfferStatus.OFFERED) {
      throw new OfferNotOfferableError(offerId);
    }
    return offer;
  }

  private async cancelActiveOffer(
    rideId: string,
    reason: OfferCancellationReason
  ): Promise<void> {
    const activeOffer = await this.offerRepository.findActiveOfferForRide(rideId);
    if (activeOffer === null) {
      return;
    }

    const cancelled = await this.offerRepository.transitionOfferStatus(
      activeOffer.id,
      OfferStatus.OFFERED,
      OfferStatus.CANCELLED
    );
    if (cancelled !== null) {
      this.emitOfferCancelled(cancelled, reason);
    }
  }

  private async noDriversFound(rideId: string, reason: string): Promise<void> {
    try {
      await this.ridesFacade.markNoDriversFound(rideId, reason);
      this.emitRideEvent(RIDE_MATCHING_NO_DRIVERS_EVENT, rideId, { rideId, reason });
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "matching.ride.no_drivers_failed",
          rideId,
          reason,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }
  }

  private emitOfferCancelled(offer: RideOffer, reason: OfferCancellationReason): void {
    this.emitOfferEvent(RIDE_OFFER_CANCELLED_EVENT, offer, { reason });
    this.offerGateway.emitOfferCancelled(offer.driverUserId, { offerId: offer.id, reason });
  }

  private emitOfferEvent(
    eventType: string,
    offer: RideOffer,
    extraPayload: Record<string, unknown> = {}
  ): void {
    this.eventEmitter.emit(
      eventType,
      this.domainEvent(eventType, "offer", offer.id, {
        offerId: offer.id,
        rideId: offer.rideId,
        driverUserId: offer.driverUserId,
        status: offer.status,
        ...extraPayload
      })
    );
  }

  private emitRideEvent(
    eventType: string,
    rideId: string,
    payload: Record<string, unknown>
  ): void {
    this.eventEmitter.emit(eventType, this.domainEvent(eventType, "ride", rideId, payload));
  }

  private domainEvent<TPayload extends Record<string, unknown>>(
    eventType: string,
    aggregateType: "ride" | "offer",
    aggregateId: string,
    payload: TPayload
  ): DomainEvent<TPayload> {
    return {
      eventId: randomUUID(),
      eventType,
      aggregateType,
      aggregateId,
      payload,
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      emittedBy: "matching"
    };
  }

  private async getMatchingRideOrLog(rideId: string): Promise<(MatchingRide & { status: RideStatus }) | null> {
    try {
      return await this.ridesFacade.getRideForMatching(rideId);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "matching.ride.not_eligible",
          rideId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return null;
    }
  }
}

