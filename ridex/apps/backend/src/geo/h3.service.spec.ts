import { cellToLatLng, isValidCell } from "h3-js";

import { H3Service, InvalidCoordinateError, InvalidH3CellError } from "./h3.service";

const HCMC_LAT = 10.7769;
const HCMC_LNG = 106.7009;

describe("H3Service", () => {
  const service = new H3Service();

  describe("isValidCoord", () => {
    it.each([
      [0, 0, true],
      [90, 180, true],
      [-90, -180, true],
      [HCMC_LAT, HCMC_LNG, true],
      [91, 0, false],
      [-91, 0, false],
      [0, 181, false],
      [0, -181, false],
      [Number.NaN, 0, false],
      [0, Number.NaN, false],
      [Number.POSITIVE_INFINITY, 0, false]
    ])("isValidCoord(%s, %s) === %s", (lat, lng, expected) => {
      expect(service.isValidCoord(lat, lng)).toBe(expected);
    });
  });

  describe("latLngToCell", () => {
    it("produces a valid H3 cell at resolution 8 and 9", () => {
      const r8 = service.latLngToCell(HCMC_LAT, HCMC_LNG, 8);
      const r9 = service.latLngToCell(HCMC_LAT, HCMC_LNG, 9);

      expect(typeof r8).toBe("string");
      expect(isValidCell(r8)).toBe(true);
      expect(isValidCell(r9)).toBe(true);
      expect(r8).not.toEqual(r9);
    });

    it("round-trips approximately back to the source coordinate", () => {
      const cell = service.latLngToCell(HCMC_LAT, HCMC_LNG, 9);
      const [lat, lng] = cellToLatLng(cell);

      expect(lat).toBeCloseTo(HCMC_LAT, 2);
      expect(lng).toBeCloseTo(HCMC_LNG, 2);
    });

    it("throws InvalidCoordinateError on out-of-range latitude", () => {
      expect(() => service.latLngToCell(91, 0, 9)).toThrow(InvalidCoordinateError);
    });

    it("throws InvalidCoordinateError on NaN", () => {
      expect(() => service.latLngToCell(Number.NaN, 0, 9)).toThrow(InvalidCoordinateError);
    });
  });

  describe("latLngToBothCells", () => {
    it("returns r8 and r9 for the same point", () => {
      const both = service.latLngToBothCells(HCMC_LAT, HCMC_LNG);

      expect(isValidCell(both.r8)).toBe(true);
      expect(isValidCell(both.r9)).toBe(true);
      expect(both.r8).not.toEqual(both.r9);
    });
  });

  describe("gridDisk", () => {
    it("k=0 returns exactly the input cell", () => {
      const cell = service.latLngToCell(HCMC_LAT, HCMC_LNG, 9);

      expect(service.gridDisk(cell, 0)).toEqual([cell]);
    });

    it("k=1 returns 7 unique cells (center + 6 neighbors)", () => {
      const cell = service.latLngToCell(HCMC_LAT, HCMC_LNG, 9);
      const disk = service.gridDisk(cell, 1);

      expect(disk).toHaveLength(7);
      expect(new Set(disk).size).toBe(7);
      expect(disk).toContain(cell);
    });

    it("k=2 returns 1 + 6*(1+2) = 19 unique cells", () => {
      const cell = service.latLngToCell(HCMC_LAT, HCMC_LNG, 9);
      const disk = service.gridDisk(cell, 2);

      expect(disk).toHaveLength(19);
      expect(new Set(disk).size).toBe(19);
    });

    it("throws InvalidH3CellError on bogus cell id", () => {
      expect(() => service.gridDisk("not-a-cell", 0)).toThrow(InvalidH3CellError);
    });

    it("throws on negative k", () => {
      const cell = service.latLngToCell(HCMC_LAT, HCMC_LNG, 9);

      expect(() => service.gridDisk(cell, -1)).toThrow(/non-negative integer/);
    });

    it("throws on non-integer k", () => {
      const cell = service.latLngToCell(HCMC_LAT, HCMC_LNG, 9);

      expect(() => service.gridDisk(cell, 1.5)).toThrow(/non-negative integer/);
    });
  });
});
