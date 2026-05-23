import type { ConfigService } from "@nestjs/config";
import type { SchedulerRegistry } from "@nestjs/schedule";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { H3RedisIndexService } from "../redis/h3-redis-index.service";
import {
  StaleDriverSweeperService,
  SWEEPER_INTERVAL_NAME
} from "./stale-driver-sweeper.service";

function createService(): {
  service: StaleDriverSweeperService;
  indexService: jest.Mocked<H3RedisIndexService>;
  schedulerRegistry: jest.Mocked<SchedulerRegistry>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const indexService = {
    sweepStale: jest.fn().mockResolvedValue(0)
  } as unknown as jest.Mocked<H3RedisIndexService>;
  const schedulerRegistry = {
    doesExist: jest.fn().mockReturnValue(false),
    addInterval: jest.fn(),
    deleteInterval: jest.fn()
  } as unknown as jest.Mocked<SchedulerRegistry>;
  const logger = {
    log: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn().mockReturnValue(30)
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return {
    service: new StaleDriverSweeperService(indexService, schedulerRegistry, logger, configService),
    indexService,
    schedulerRegistry,
    logger
  };
}

describe("StaleDriverSweeperService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("registers an interval on bootstrap with the configured period", () => {
    const { service, schedulerRegistry } = createService();

    service.onApplicationBootstrap();

    expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
      SWEEPER_INTERVAL_NAME,
      expect.anything()
    );
  });

  it("does not register twice if interval already exists", () => {
    const { service, schedulerRegistry } = createService();
    (schedulerRegistry.doesExist as jest.Mock).mockReturnValue(true);

    service.onApplicationBootstrap();

    expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
  });

  it("removes the interval on shutdown", () => {
    const { service, schedulerRegistry } = createService();
    (schedulerRegistry.doesExist as jest.Mock).mockReturnValue(true);

    service.onApplicationShutdown();

    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(SWEEPER_INTERVAL_NAME);
  });

  it("tick calls sweepStale and logs the result", async () => {
    const { service, indexService, logger } = createService();
    (indexService.sweepStale as jest.Mock).mockResolvedValue(3);

    await service.tick();

    expect(indexService.sweepStale).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.sweep", evicted: 3 }),
      "StaleDriverSweeperService"
    );
  });

  it("re-entrancy guard skips overlapping ticks", async () => {
    const { service, indexService } = createService();
    let resolveFirst: () => void = () => undefined;
    (indexService.sweepStale as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          resolveFirst = () => resolve(0);
        })
    );

    const firstTick = service.tick();
    const secondTick = service.tick();

    await secondTick;
    expect(indexService.sweepStale).toHaveBeenCalledTimes(1);

    resolveFirst();
    await firstTick;
    expect(indexService.sweepStale).toHaveBeenCalledTimes(1);
  });

  it("tick logs error and recovers when sweepStale throws", async () => {
    const { service, indexService, logger } = createService();
    (indexService.sweepStale as jest.Mock).mockRejectedValue(new Error("redis down"));

    await service.tick();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.sweep.failed" }),
      expect.any(String),
      "StaleDriverSweeperService"
    );

    // Second tick should be able to run.
    (indexService.sweepStale as jest.Mock).mockResolvedValue(0);
    await service.tick();
    expect(indexService.sweepStale).toHaveBeenCalledTimes(2);
  });
});
