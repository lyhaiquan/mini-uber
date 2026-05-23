import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import type { CreateRideOfferInput } from "../matching.types";
import { RideOffer } from "../entities/ride-offer.entity";
import { OfferStatus } from "../enums/offer-status.enum";

const ATTEMPTED_STATUSES: readonly OfferStatus[] = [
  OfferStatus.OFFERED,
  OfferStatus.ACCEPTED,
  OfferStatus.REJECTED,
  OfferStatus.TIMED_OUT,
  OfferStatus.CANCELLED
];

@Injectable()
export class RideOfferRepository {
  constructor(
    @InjectRepository(RideOffer) private readonly repository: Repository<RideOffer>
  ) {}

  async insertOffer(input: CreateRideOfferInput): Promise<RideOffer> {
    const offer = this.repository.create({
      rideId: input.rideId,
      driverUserId: input.driverUserId,
      status: OfferStatus.OFFERED,
      attemptNumber: input.attemptNumber,
      score: input.score,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      routeConfidence: input.routeConfidence,
      offeredAt: new Date(),
      expiresAt: input.expiresAt,
      respondedAt: null,
      finalizedAt: null,
      version: 0
    });

    return this.repository.save(offer);
  }

  async findById(offerId: string): Promise<RideOffer | null> {
    return this.repository.findOne({ where: { id: offerId } });
  }

  async findActiveOfferForDriver(driverUserId: string): Promise<RideOffer | null> {
    return this.repository.findOne({
      where: { driverUserId, status: OfferStatus.OFFERED }
    });
  }

  async findActiveOfferForRide(rideId: string): Promise<RideOffer | null> {
    return this.repository.findOne({
      where: { rideId, status: OfferStatus.OFFERED }
    });
  }

  async hasActiveOfferForDriver(driverUserId: string): Promise<boolean> {
    return (await this.findActiveOfferForDriver(driverUserId)) !== null;
  }

  async findAttemptedDriverIds(rideId: string): Promise<string[]> {
    const offers = await this.repository.find({
      where: { rideId, status: In([...ATTEMPTED_STATUSES]) },
      select: { driverUserId: true }
    });
    return offers.map((offer) => offer.driverUserId);
  }

  async countAttempts(rideId: string): Promise<number> {
    return this.repository.count({
      where: { rideId, status: In([...ATTEMPTED_STATUSES]) }
    });
  }

  async transitionOfferStatus(
    offerId: string,
    fromStatus: OfferStatus,
    toStatus: OfferStatus
  ): Promise<RideOffer | null> {
    const now = new Date();
    const patch: QueryDeepPartialEntity<RideOffer> = {
      status: toStatus,
      version: () => "\"version\" + 1"
    };

    if (toStatus === OfferStatus.ACCEPTED || toStatus === OfferStatus.REJECTED) {
      patch.respondedAt = now;
    }

    if (toStatus !== OfferStatus.OFFERED) {
      patch.finalizedAt = now;
    }

    const result = await this.repository
      .createQueryBuilder()
      .update(RideOffer)
      .set(patch)
      .where("id = :offerId", { offerId })
      .andWhere("status = :fromStatus", { fromStatus })
      .execute();

    if (result.affected !== 1) {
      return null;
    }

    return this.findById(offerId);
  }
}
