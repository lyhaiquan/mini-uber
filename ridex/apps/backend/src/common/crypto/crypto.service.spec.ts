import { CryptoService } from "./crypto.service";

describe("CryptoService", () => {
  const service = new CryptoService();

  describe("generateRefreshToken", () => {
    it("produces a parseable token of the expected shape", () => {
      const generated = service.generateRefreshToken();
      const parsed = service.parseRefreshToken(generated.token);

      expect(parsed).toEqual({
        tokenId: generated.tokenId,
        secret: generated.secret
      });
      expect(generated.token).toBe(`${generated.tokenId}.${generated.secret}`);
      expect(generated.secret).toHaveLength(64);
    });

    it("produces unique tokens across invocations", () => {
      const first = service.generateRefreshToken();
      const second = service.generateRefreshToken();

      expect(first.tokenId).not.toBe(second.tokenId);
      expect(first.secret).not.toBe(second.secret);
    });
  });

  describe("parseRefreshToken", () => {
    it("rejects non-string input", () => {
      expect(service.parseRefreshToken(undefined)).toBeUndefined();
      expect(service.parseRefreshToken(123)).toBeUndefined();
      expect(service.parseRefreshToken(null)).toBeUndefined();
    });

    it("rejects malformed tokens", () => {
      expect(service.parseRefreshToken("not-a-token")).toBeUndefined();
      expect(service.parseRefreshToken("a.b")).toBeUndefined();
      expect(service.parseRefreshToken("invalid-uuid.short")).toBeUndefined();
    });
  });

  describe("hashRefreshSecret", () => {
    it("is deterministic", () => {
      const secret = "a".repeat(64);
      expect(service.hashRefreshSecret(secret)).toBe(service.hashRefreshSecret(secret));
    });

    it("differs for different inputs", () => {
      expect(service.hashRefreshSecret("a".repeat(64))).not.toBe(
        service.hashRefreshSecret("b".repeat(64))
      );
    });
  });

  describe("constantTimeEquals", () => {
    it("returns true for identical hex strings", () => {
      expect(service.constantTimeEquals("deadbeef", "deadbeef")).toBe(true);
    });

    it("returns false for different hex strings", () => {
      expect(service.constantTimeEquals("deadbeef", "cafebabe")).toBe(false);
    });

    it("returns false for different lengths", () => {
      expect(service.constantTimeEquals("dead", "deadbeef")).toBe(false);
    });
  });
});
