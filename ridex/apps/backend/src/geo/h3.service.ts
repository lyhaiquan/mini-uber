import { Injectable } from "@nestjs/common";
import { gridDisk, isValidCell, latLngToCell } from "h3-js";

import {
  H3_DRIVER_INDEX_RES_8,
  H3_DRIVER_INDEX_RES_9,
  type H3DriverIndexResolution
} from "./geo.constants";

export class InvalidCoordinateError extends Error {
  constructor(lat: number, lng: number) {
    super(`Invalid coordinate: lat=${lat}, lng=${lng}`);
    this.name = "InvalidCoordinateError";
  }
}

export class InvalidH3CellError extends Error {
  constructor(cellId: string) {
    super(`Invalid H3 cell: ${cellId}`);
    this.name = "InvalidH3CellError";
  }
}

@Injectable()
export class H3Service {
  isValidCoord(lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }
    if (lat < -90 || lat > 90) {
      return false;
    }
    if (lng < -180 || lng > 180) {
      return false;
    }
    return true;
  }

  latLngToCell(lat: number, lng: number, resolution: H3DriverIndexResolution): string {
    if (!this.isValidCoord(lat, lng)) {
      throw new InvalidCoordinateError(lat, lng);
    }
    return latLngToCell(lat, lng, resolution);
  }

  latLngToBothCells(lat: number, lng: number): { r8: string; r9: string } {
    return {
      r8: this.latLngToCell(lat, lng, H3_DRIVER_INDEX_RES_8),
      r9: this.latLngToCell(lat, lng, H3_DRIVER_INDEX_RES_9)
    };
  }

  gridDisk(cellId: string, k: number): string[] {
    if (!isValidCell(cellId)) {
      throw new InvalidH3CellError(cellId);
    }
    if (!Number.isInteger(k) || k < 0) {
      throw new Error(`gridDisk k must be a non-negative integer, got: ${k}`);
    }
    return gridDisk(cellId, k);
  }
}
