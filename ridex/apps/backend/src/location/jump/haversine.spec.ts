import { haversine } from "./haversine";

describe("haversine", () => {
  it("returns 0 for the same point", () => {
    expect(haversine(10, 106, 10, 106)).toBeCloseTo(0, 5);
  });

  it("returns about 111 km for one degree latitude", () => {
    expect(haversine(0, 0, 1, 0)).toBeGreaterThan(110_000);
    expect(haversine(0, 0, 1, 0)).toBeLessThan(112_000);
  });

  it("returns about 78 km for one degree longitude at latitude 45", () => {
    expect(haversine(45, 0, 45, 1)).toBeGreaterThan(78_000);
    expect(haversine(45, 0, 45, 1)).toBeLessThan(79_000);
  });
});

