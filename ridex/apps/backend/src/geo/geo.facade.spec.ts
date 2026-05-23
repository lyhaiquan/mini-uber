import type { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../config/env.validation";
import { GeoFacade, InvalidDiscoveryRingError } from "./geo.facade";
import { H3Service } from "./h3.service";
import type { H3RedisIndexService } from "./redis/h3-redis-index.service";

const MAX_RING = 5;

function createFacade(): {
  facade: GeoFacade;
  indexService: jest.Mocked<H3RedisIndexService>;
  h3Service: H3Service;
} {
  const indexService = {
    findNearbyDrivers: jest.fn().mockResolvedValue([]),
    getOnlineDriverCount: jest.fn().mockResolvedValue(0)
  } as unknown as jest.Mocked<H3RedisIndexService>;
  const h3Service = new H3Service();
  const configService = {
    get: jest.fn().mockReturnValue(MAX_RING)
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return {
    facade: new GeoFacade(indexService, h3Service, configService),
    indexService,
    h3Service
  };
}

describe("GeoFacade", () => {
  it("uses the env max when maxRing is not provided", async () => {
    const { facade, indexService } = createFacade();

    await facade.findNearbyDrivers({ lat: 10, lng: 106 });

    expect(indexService.findNearbyDrivers).toHaveBeenCalledWith(10, 106, MAX_RING);
  });

  it("clamps maxRing above the env cap", async () => {
    const { facade, indexService } = createFacade();

    await facade.findNearbyDrivers({ lat: 10, lng: 106, maxRing: 999 });

    expect(indexService.findNearbyDrivers).toHaveBeenCalledWith(10, 106, MAX_RING);
  });

  it("throws on negative maxRing", async () => {
    const { facade, indexService } = createFacade();

    await expect(
      facade.findNearbyDrivers({ lat: 10, lng: 106, maxRing: -2 })
    ).rejects.toThrow(InvalidDiscoveryRingError);

    expect(indexService.findNearbyDrivers).not.toHaveBeenCalled();
  });

  it("throws on non-finite maxRing", async () => {
    const { facade, indexService } = createFacade();

    await expect(
      facade.findNearbyDrivers({ lat: 10, lng: 106, maxRing: Number.NaN })
    ).rejects.toThrow(InvalidDiscoveryRingError);

    expect(indexService.findNearbyDrivers).not.toHaveBeenCalled();
  });

  it("floors fractional maxRing", async () => {
    const { facade, indexService } = createFacade();

    await facade.findNearbyDrivers({ lat: 10, lng: 106, maxRing: 2.9 });

    expect(indexService.findNearbyDrivers).toHaveBeenCalledWith(10, 106, 2);
  });

  it("returns the index service result unchanged", async () => {
    const { facade, indexService } = createFacade();
    indexService.findNearbyDrivers.mockResolvedValue(["driver-A", "driver-B"]);

    await expect(facade.findNearbyDrivers({ lat: 10, lng: 106, maxRing: 1 })).resolves.toEqual([
      "driver-A",
      "driver-B"
    ]);
  });

  it("returns H3 cells for a pickup location", () => {
    const { facade } = createFacade();

    const cells = facade.cellsForLocation(10.7769, 106.7009);

    expect(typeof cells.r8).toBe("string");
    expect(typeof cells.r9).toBe("string");
    expect(cells.r8).not.toBe(cells.r9);
  });

  it("delegates online driver count to the index service", async () => {
    const { facade, indexService } = createFacade();
    indexService.getOnlineDriverCount.mockResolvedValue(7);

    await expect(facade.getOnlineDriverCount("8928308280fffff", 8)).resolves.toBe(7);
    expect(indexService.getOnlineDriverCount).toHaveBeenCalledWith("8928308280fffff", 8);
  });
});
