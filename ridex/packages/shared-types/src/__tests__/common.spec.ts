import { describe, expect, it } from "vitest";
import { z } from "zod";

import { apiEnvelopeSchema, apiErrorSchema, geoPointSchema } from "../common";

describe("common schemas", () => {
  it("wraps any data type with envelope", () => {
    const schema = apiEnvelopeSchema(z.object({ count: z.number() }));
    const parsed = schema.parse({ data: { count: 7 }, meta: { requestId: "req-1" } });
    expect(parsed.data.count).toBe(7);
    expect(parsed.meta?.requestId).toBe("req-1");
  });

  it("parses an api error envelope", () => {
    const parsed = apiErrorSchema.parse({
      error: { code: "RIDE_NOT_FOUND", message: "ride 1 not found" }
    });
    expect(parsed.error.code).toBe("RIDE_NOT_FOUND");
  });

  it("rejects geo point with empty address", () => {
    expect(() => geoPointSchema.parse({ lat: 10, lng: 106, address: "" })).toThrow();
  });
});
