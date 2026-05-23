import type { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/env.validation";
import { FareSplitService } from "./fare-split.service";

describe("FareSplitService", () => {
  it("splits fare with 80/20 integer arithmetic", () => {
    const service = createService();

    expect(service.split(100_000)).toMatchObject({
      driverShareVnd: 80_000,
      platformShareVnd: 20_000,
      driverShareBps: 8000,
      platformShareBps: 2000
    });
  });

  it("assigns rounding remainder to platform", () => {
    const service = createService();

    expect(service.split(99)).toMatchObject({
      driverShareVnd: 79,
      platformShareVnd: 20
    });
  });

  it("keeps shares equal to total", () => {
    const service = createService();
    const result = service.split(123_457);

    expect(result.driverShareVnd + result.platformShareVnd).toBe(123_457);
  });

  it("handles zero total", () => {
    const service = createService();

    expect(service.split(0)).toMatchObject({ driverShareVnd: 0, platformShareVnd: 0 });
  });

  it("handles total=1 by assigning all value to platform", () => {
    const service = createService();

    expect(service.split(1)).toMatchObject({ driverShareVnd: 0, platformShareVnd: 1 });
  });

  it("throws on invalid totals", () => {
    const service = createService();

    expect(() => service.split(-1)).toThrow(/Invalid payment total/);
    expect(() => service.split(1.5)).toThrow(/Invalid payment total/);
  });
});

function createService(): FareSplitService {
  const config = {
    PAYMENT_DRIVER_SHARE_BPS: 8000,
    PAYMENT_PLATFORM_SHARE_BPS: 2000
  };
  const configService = {
    get: jest.fn((key: keyof typeof config) => config[key])
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new FareSplitService(configService);
}
