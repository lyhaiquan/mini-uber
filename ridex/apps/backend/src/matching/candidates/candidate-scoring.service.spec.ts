import { CandidateScoringService } from "./candidate-scoring.service";

describe("CandidateScoringService", () => {
  const service = new CandidateScoringService();

  it("assigns lower scores to shorter distances", () => {
    const weights = { distanceWeight: 0.6, etaWeight: 0.4 };

    expect(
      service.score({ distanceMeters: 1000, durationSeconds: 300, confidence: "high" }, weights)
    ).toBeLessThan(
      service.score({ distanceMeters: 5000, durationSeconds: 300, confidence: "high" }, weights)
    );
  });

  it("assigns lower scores to shorter durations", () => {
    const weights = { distanceWeight: 0.6, etaWeight: 0.4 };

    expect(
      service.score({ distanceMeters: 1000, durationSeconds: 120, confidence: "high" }, weights)
    ).toBeLessThan(
      service.score({ distanceMeters: 1000, durationSeconds: 600, confidence: "high" }, weights)
    );
  });

  it("respects distance-only weights", () => {
    const weights = { distanceWeight: 1, etaWeight: 0 };

    expect(
      service.score({ distanceMeters: 1000, durationSeconds: 600, confidence: "high" }, weights)
    ).toBe(
      service.score({ distanceMeters: 1000, durationSeconds: 60, confidence: "high" }, weights)
    );
  });

  it("uses stable distance and ETA normalization constants", () => {
    expect(
      service.score(
        { distanceMeters: 10_000, durationSeconds: 600, confidence: "high" },
        { distanceWeight: 0.6, etaWeight: 0.4 }
      )
    ).toBeCloseTo(1);
  });

  it("adds a fixed low-confidence penalty", () => {
    const weights = { distanceWeight: 0.6, etaWeight: 0.4 };
    const high = service.score(
      { distanceMeters: 1000, durationSeconds: 60, confidence: "high" },
      weights
    );
    const low = service.score(
      { distanceMeters: 1000, durationSeconds: 60, confidence: "low" },
      weights
    );

    expect(low - high).toBeCloseTo(0.1);
  });

  it("returns zero for zero distance and duration with high confidence", () => {
    expect(
      service.score(
        { distanceMeters: 0, durationSeconds: 0, confidence: "high" },
        { distanceWeight: 0.6, etaWeight: 0.4 }
      )
    ).toBe(0);
  });
});

