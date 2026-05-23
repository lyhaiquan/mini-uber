import type { GeoFacade } from "../geo/geo.facade";
import type { RouteEstimator } from "../routing/route-estimator";
import type { PricingSnapshot } from "./entities/pricing-snapshot.entity";
import type { FareCalculatorService } from "./fare/fare-calculator.service";
import { PricingFacade } from "./pricing.facade";
import type { PricingSnapshotRepository } from "./snapshot/pricing-snapshot.repository";
import type { SurgeService } from "./surge/surge.service";

describe("PricingFacade", () => {
  it("delegates getSnapshotForRide to the repository", async () => {
    const { facade, repository } = createFacade();
    repository.findByRideId.mockResolvedValue({ id: "snap-1" } as PricingSnapshot);

    await expect(facade.getSnapshotForRide("ride-1")).resolves.toMatchObject({ id: "snap-1" });
    expect(repository.findByRideId).toHaveBeenCalledWith("ride-1");
  });

  it("returns null when no snapshot exists", async () => {
    const { facade, repository } = createFacade();
    repository.findByRideId.mockResolvedValue(null);

    await expect(facade.getSnapshotForRide("none")).resolves.toBeNull();
  });

  it("computes a fare estimate without persisting a snapshot", async () => {
    const { facade, geoFacade, routeEstimator, surgeService, fareCalculator, repository } =
      createFacade();

    await expect(
      facade.computeFareEstimate({
        pickup: { lat: 10, lng: 106 },
        destination: { lat: 11, lng: 107 }
      })
    ).resolves.toMatchObject({
      currency: "VND",
      pickupH3R8: "8828308281fffff",
      totalVnd: 63000,
      surge: expect.objectContaining({ multiplier: 1.5 })
    });

    expect(geoFacade.cellsForLocation).toHaveBeenCalledWith(10, 106);
    expect(routeEstimator.estimate).toHaveBeenCalledWith({
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 11, lng: 107 }
    });
    expect(surgeService.getMultiplier).toHaveBeenCalledWith("8828308281fffff");
    expect(fareCalculator.compute).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceMeters: 5000,
        durationSeconds: 600,
        surgeMultiplier: 1.5,
        routeConfidence: "high"
      })
    );
    expect(repository.findByRideId).not.toHaveBeenCalled();
  });
});

function createFacade(): {
  facade: PricingFacade;
  repository: jest.Mocked<PricingSnapshotRepository>;
  geoFacade: jest.Mocked<GeoFacade>;
  routeEstimator: jest.Mocked<RouteEstimator>;
  surgeService: jest.Mocked<SurgeService>;
  fareCalculator: jest.Mocked<FareCalculatorService>;
} {
  const repository = {
    findByRideId: jest.fn()
  } as unknown as jest.Mocked<PricingSnapshotRepository>;
  const geoFacade = {
    cellsForLocation: jest.fn().mockReturnValue({
      r8: "8828308281fffff",
      r9: "8928308280fffff"
    })
  } as unknown as jest.Mocked<GeoFacade>;
  const routeEstimator = {
    estimate: jest.fn().mockResolvedValue({
      distanceMeters: 5000,
      durationSeconds: 600,
      polyline: null,
      polylineFormat: null,
      confidence: "high",
      source: "osrm"
    })
  } as unknown as jest.Mocked<RouteEstimator>;
  const surgeService = {
    getMultiplier: jest.fn().mockResolvedValue({
      cellR8: "8828308281fffff",
      demand: 5,
      supply: 2,
      ratio: 2.5,
      multiplier: 1.5
    })
  } as unknown as jest.Mocked<SurgeService>;
  const fareCalculator = {
    compute: jest.fn().mockReturnValue({
      baseFareVnd: 12000,
      distanceMeters: 5000,
      distanceFeeVnd: 25000,
      durationSeconds: 600,
      durationFeeVnd: 5000,
      subtotalVnd: 42000,
      surgeMultiplier: 1.5,
      surgeAmountVnd: 21000,
      minimumFareVnd: 15000,
      totalVnd: 63000,
      routeConfidence: "high"
    })
  } as unknown as jest.Mocked<FareCalculatorService>;

  return {
    facade: new PricingFacade(
      repository,
      geoFacade,
      routeEstimator,
      surgeService,
      fareCalculator
    ),
    repository,
    geoFacade,
    routeEstimator,
    surgeService,
    fareCalculator
  };
}
