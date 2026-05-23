import type { Repository } from "typeorm";

import type { PricingSnapshot } from "../entities/pricing-snapshot.entity";
import { PricingSnapshotRepository } from "./pricing-snapshot.repository";

function createRepo(): {
  repository: PricingSnapshotRepository;
  typeormRepository: jest.Mocked<Repository<PricingSnapshot>>;
} {
  const typeormRepository = {
    create: jest.fn((payload: Partial<PricingSnapshot>) => payload as PricingSnapshot),
    save: jest.fn().mockImplementation(async (snapshot: PricingSnapshot) => ({
      ...snapshot,
      id: "snap-1"
    })),
    findOne: jest.fn().mockResolvedValue(null)
  } as unknown as jest.Mocked<Repository<PricingSnapshot>>;

  return { repository: new PricingSnapshotRepository(typeormRepository), typeormRepository };
}

describe("PricingSnapshotRepository", () => {
  it("creates a snapshot with VND currency", async () => {
    const { repository, typeormRepository } = createRepo();

    await repository.insert({
      rideId: "ride-1",
      pickupH3R8: "8828308281fffff",
      baseFareVnd: 12000,
      distanceMeters: 1000,
      distanceFeeVnd: 5000,
      durationSeconds: 60,
      durationFeeVnd: 500,
      subtotalVnd: 17500,
      surgeMultiplier: 1,
      surgeAmountVnd: 0,
      minimumFareVnd: 15000,
      totalVnd: 17500,
      routeConfidence: "high",
      routePolyline: null,
      routePolylineFormat: null
    });

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "VND",
        rideId: "ride-1",
        totalVnd: 17500,
        surgeMultiplier: 1
      })
    );
    expect(typeormRepository.save).toHaveBeenCalled();
  });

  it("findByRideId returns null on miss", async () => {
    const { repository, typeormRepository } = createRepo();
    (typeormRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(repository.findByRideId("nope")).resolves.toBeNull();
    expect(typeormRepository.findOne).toHaveBeenCalledWith({ where: { rideId: "nope" } });
  });

  it("findByRideId returns the snapshot when found", async () => {
    const { repository, typeormRepository } = createRepo();
    (typeormRepository.findOne as jest.Mock).mockResolvedValue({ id: "snap-1" } as PricingSnapshot);

    await expect(repository.findByRideId("ride-1")).resolves.toMatchObject({ id: "snap-1" });
  });
});
