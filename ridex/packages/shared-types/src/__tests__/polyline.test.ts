import { describe, expect, it } from "vitest";

import { decodePolyline5 } from "../polyline";

describe("decodePolyline5", () => {
  // Sample from https://developers.google.com/maps/documentation/utilities/polylinealgorithm
  it("decodes the canonical Google example to its three points", () => {
    const points = decodePolyline5("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toHaveLength(3);
    expect(points[0]?.lat).toBeCloseTo(38.5, 5);
    expect(points[0]?.lng).toBeCloseTo(-120.2, 5);
    expect(points[1]?.lat).toBeCloseTo(40.7, 5);
    expect(points[1]?.lng).toBeCloseTo(-120.95, 5);
    expect(points[2]?.lat).toBeCloseTo(43.252, 3);
    expect(points[2]?.lng).toBeCloseTo(-126.453, 3);
  });

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline5("")).toEqual([]);
  });
});
