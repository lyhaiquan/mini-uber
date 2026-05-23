import type { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/env.validation";
import { InvalidPricingInputError } from "../errors/pricing-errors";
import { FareCalculatorService } from "./fare-calculator.service";

const DEFAULTS = {
  PRICING_BASE_FARE_VND: 12000,
  PRICING_PER_KM_VND: 5000,
  PRICING_PER_MIN_VND: 500,
  PRICING_MINIMUM_FARE_VND: 15000
};

function createCalculator(overrides: Partial<typeof DEFAULTS> = {}): FareCalculatorService {
  const values = { ...DEFAULTS, ...overrides };
  const configService = {
    get: jest.fn((key: keyof typeof DEFAULTS) => values[key])
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new FareCalculatorService(configService);
}

describe("FareCalculatorService", () => {
  it("computes a basic fare with no surge", () => {
    const calc = createCalculator();

    const result = calc.compute({
      distanceMeters: 4_000,
      durationSeconds: 600,
      surgeMultiplier: 1,
      routeConfidence: "high"
    });

    expect(result).toMatchObject({
      baseFareVnd: 12000,
      distanceFeeVnd: 20_000,
      durationFeeVnd: 5_000,
      subtotalVnd: 37_000,
      surgeMultiplier: 1,
      surgeAmountVnd: 0,
      totalVnd: 37_000
    });
  });

  it("applies the surge multiplier with integer arithmetic", () => {
    const calc = createCalculator();

    const result = calc.compute({
      distanceMeters: 2_000,
      durationSeconds: 300,
      surgeMultiplier: 1.5,
      routeConfidence: "high"
    });

    expect(result.subtotalVnd).toBe(12_000 + 10_000 + 2_500);
    expect(result.surgeAmountVnd).toBe(Math.floor(result.subtotalVnd * 0.5));
    expect(result.totalVnd).toBe(result.subtotalVnd + result.surgeAmountVnd);
  });

  it("clamps total to minimum fare for very short trips", () => {
    const calc = createCalculator();

    const result = calc.compute({
      distanceMeters: 0,
      durationSeconds: 0,
      surgeMultiplier: 1,
      routeConfidence: "high"
    });

    expect(result.subtotalVnd).toBe(12_000);
    expect(result.totalVnd).toBe(15_000);
  });

  it("respects very large distance without losing integer precision", () => {
    const calc = createCalculator();

    const result = calc.compute({
      distanceMeters: 1_234_567,
      durationSeconds: 3_600,
      surgeMultiplier: 2,
      routeConfidence: "low"
    });

    const expectedDistanceFee = Math.floor((1_234_567 * 5000) / 1000);
    const expectedDurationFee = Math.floor((3600 * 500) / 60);
    const expectedSubtotal = 12000 + expectedDistanceFee + expectedDurationFee;
    expect(result.distanceFeeVnd).toBe(expectedDistanceFee);
    expect(result.durationFeeVnd).toBe(expectedDurationFee);
    expect(result.subtotalVnd).toBe(expectedSubtotal);
    expect(result.surgeAmountVnd).toBe(Math.floor(expectedSubtotal * 1));
    expect(result.totalVnd).toBe(expectedSubtotal * 2);
    expect(Number.isInteger(result.totalVnd)).toBe(true);
  });

  it("floors surge multiplier to 3 decimals on the output", () => {
    const calc = createCalculator();

    const result = calc.compute({
      distanceMeters: 1000,
      durationSeconds: 60,
      surgeMultiplier: 1.23456,
      routeConfidence: "high"
    });

    expect(result.surgeMultiplier).toBe(1.234);
  });

  it("applies tiny surge above 1.0 using 1000-scale integer math", () => {
    const calc = createCalculator();

    const result = calc.compute({
      distanceMeters: 1000,
      durationSeconds: 60,
      surgeMultiplier: 1.001,
      routeConfidence: "high"
    });

    expect(result.surgeMultiplier).toBe(1.001);
    expect(result.surgeAmountVnd).toBe(Math.floor(result.subtotalVnd / 1000));
  });

  it("never returns a negative surge amount when multiplier is exactly 1", () => {
    const calc = createCalculator();

    const result = calc.compute({
      distanceMeters: 1000,
      durationSeconds: 60,
      surgeMultiplier: 1,
      routeConfidence: "high"
    });

    expect(result.surgeAmountVnd).toBe(0);
  });

  it("throws on invalid distance", () => {
    const calc = createCalculator();

    expect(() =>
      calc.compute({
        distanceMeters: -1,
        durationSeconds: 60,
        surgeMultiplier: 1,
        routeConfidence: "high"
      })
    ).toThrow(InvalidPricingInputError);
  });

  it("throws on invalid duration", () => {
    const calc = createCalculator();

    expect(() =>
      calc.compute({
        distanceMeters: 1000,
        durationSeconds: Number.NaN,
        surgeMultiplier: 1,
        routeConfidence: "high"
      })
    ).toThrow(InvalidPricingInputError);
  });

  it("throws on surge multiplier below 1", () => {
    const calc = createCalculator();

    expect(() =>
      calc.compute({
        distanceMeters: 1000,
        durationSeconds: 60,
        surgeMultiplier: 0.9,
        routeConfidence: "high"
      })
    ).toThrow(InvalidPricingInputError);
  });

  it("uses configured base, per-km and per-min rates", () => {
    const calc = createCalculator({
      PRICING_BASE_FARE_VND: 20_000,
      PRICING_PER_KM_VND: 10_000,
      PRICING_PER_MIN_VND: 1_000
    });

    const result = calc.compute({
      distanceMeters: 5_000,
      durationSeconds: 600,
      surgeMultiplier: 1,
      routeConfidence: "high"
    });

    expect(result.baseFareVnd).toBe(20_000);
    expect(result.distanceFeeVnd).toBe(50_000);
    expect(result.durationFeeVnd).toBe(10_000);
  });
});
