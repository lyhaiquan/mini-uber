import { describe, expect, it } from "vitest";

import { driverLocationDtoSchema, locationAckSchema } from "../drivers";

describe("driver schemas", () => {
  it("accepts a valid driver location payload", () => {
    const parsed = driverLocationDtoSchema.parse({
      lat: 10.77,
      lng: 106.7,
      heading: 90,
      speed: 12.5,
      accuracy: 5,
      recordedAt: "2026-05-18T10:00:00.000Z"
    });
    expect(parsed.heading).toBe(90);
  });

  it("rejects extra fields on driver location (backend forbidNonWhitelisted)", () => {
    const parsed = driverLocationDtoSchema.safeParse({
      lat: 10,
      lng: 106,
      driverId: "spoofed",
      recordedAt: "2026-05-18T10:00:00.000Z"
    });
    expect(parsed.success).toBe(false);
  });

  it("parses LocationAck success variant", () => {
    const ok = locationAckSchema.parse({ ok: true });
    expect(ok.ok).toBe(true);
  });

  it("parses LocationAck error variant with code + message", () => {
    const err = locationAckSchema.parse({
      ok: false,
      error: { code: "GPS_JUMP_SPEED", message: "speed too high" }
    });
    if (err.ok === false) {
      expect(err.error.code).toBe("GPS_JUMP_SPEED");
    } else {
      throw new Error("expected discriminator to be false");
    }
  });

  it("rejects malformed LocationAck (missing error when ok=false)", () => {
    const result = locationAckSchema.safeParse({ ok: false });
    expect(result.success).toBe(false);
  });
});
