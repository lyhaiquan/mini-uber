import type { Repository } from "typeorm";

import type { RideOffer } from "../entities/ride-offer.entity";
import { OfferStatus } from "../enums/offer-status.enum";
import { RideOfferRepository } from "./ride-offer.repository";

describe("RideOfferRepository", () => {
  it("inserts offers with OFFERED status", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.save.mockImplementation(async (offer) => ({
      ...offer,
      id: "offer-1"
    }) as RideOffer);

    const result = await repository.insertOffer({
      rideId: "ride-1",
      driverUserId: "driver-1",
      attemptNumber: 1,
      score: 0.5,
      distanceMeters: 100,
      durationSeconds: 20,
      routeConfidence: "high",
      expiresAt: new Date("2026-05-17T08:00:00.000Z")
    });

    expect(result.status).toBe(OfferStatus.OFFERED);
    expect(typeormRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        rideId: "ride-1",
        driverUserId: "driver-1",
        status: OfferStatus.OFFERED
      })
    );
  });

  it("finds active offers for a driver", async () => {
    const { repository, typeormRepository } = createRepository();

    await repository.findActiveOfferForDriver("driver-1");

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { driverUserId: "driver-1", status: OfferStatus.OFFERED }
    });
  });

  it("returns attempted driver ids for a ride", async () => {
    const { repository, typeormRepository } = createRepository();
    typeormRepository.find.mockResolvedValue([
      { driverUserId: "driver-1" },
      { driverUserId: "driver-2" }
    ] as RideOffer[]);

    await expect(repository.findAttemptedDriverIds("ride-1")).resolves.toEqual([
      "driver-1",
      "driver-2"
    ]);
  });

  it("conditionally transitions status and returns the updated offer", async () => {
    const { repository, typeormRepository, queryBuilder } = createRepository();
    queryBuilder.execute.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
    typeormRepository.findOne.mockResolvedValue({ id: "offer-1", status: OfferStatus.ACCEPTED } as RideOffer);

    await expect(
      repository.transitionOfferStatus("offer-1", OfferStatus.OFFERED, OfferStatus.ACCEPTED)
    ).resolves.toMatchObject({ id: "offer-1", status: OfferStatus.ACCEPTED });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith("status = :fromStatus", {
      fromStatus: OfferStatus.OFFERED
    });
  });

  it("returns null when a conditional transition is stale", async () => {
    const { repository, queryBuilder } = createRepository();
    queryBuilder.execute.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

    await expect(
      repository.transitionOfferStatus("offer-1", OfferStatus.OFFERED, OfferStatus.ACCEPTED)
    ).resolves.toBeNull();
  });
});

function createRepository(): {
  repository: RideOfferRepository;
  typeormRepository: jest.Mocked<Repository<RideOffer>>;
  queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
} {
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn()
  };
  const typeormRepository = {
    create: jest.fn((payload: Partial<RideOffer>) => payload as RideOffer),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
  } as unknown as jest.Mocked<Repository<RideOffer>>;

  return {
    repository: new RideOfferRepository(typeormRepository),
    typeormRepository,
    queryBuilder
  };
}
