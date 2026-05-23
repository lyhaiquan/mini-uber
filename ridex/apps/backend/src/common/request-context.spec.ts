import { normalizeCorrelationId } from "./request-context";

describe("normalizeCorrelationId", () => {
  it("accepts safe correlation IDs", () => {
    expect(normalizeCorrelationId("req_123-test:abc")).toBe("req_123-test:abc");
  });

  it("rejects empty correlation IDs", () => {
    expect(normalizeCorrelationId(" ")).toBeUndefined();
  });

  it("rejects correlation IDs with unsafe characters", () => {
    expect(normalizeCorrelationId("req 123")).toBeUndefined();
  });

  it("rejects very long correlation IDs", () => {
    expect(normalizeCorrelationId("a".repeat(129))).toBeUndefined();
  });
});
