import { describe, expect, it } from "vitest";

import { authTokensSchema, registerDtoSchema, roleSchema, userSchema } from "../auth";

describe("auth schemas", () => {
  it("parses a valid AuthTokens payload", () => {
    const result = authTokensSchema.parse({
      accessToken: "header.payload.sig",
      refreshToken: "refresh-token-string",
      accessTokenExpiresInSeconds: 900,
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "user@example.com",
        role: "CUSTOMER"
      }
    });

    expect(result.user.role).toBe("CUSTOMER");
    expect(result.accessTokenExpiresInSeconds).toBe(900);
  });

  it("rejects an AuthTokens payload missing required fields", () => {
    expect(() => authTokensSchema.parse({ email: "x" })).toThrow();
  });

  it("rejects RegisterDto with bad email and short password", () => {
    const parsed = registerDtoSchema.safeParse({ email: "bad", password: "short" });
    expect(parsed.success).toBe(false);
  });

  it("RegisterDto is strict — rejects `role` field (backend assigns role server-side)", () => {
    const parsed = registerDtoSchema.safeParse({
      email: "user@example.com",
      password: "valid-password-123",
      role: "ADMIN"
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts all three roles", () => {
    expect(roleSchema.parse("CUSTOMER")).toBe("CUSTOMER");
    expect(roleSchema.parse("DRIVER")).toBe("DRIVER");
    expect(roleSchema.parse("ADMIN")).toBe("ADMIN");
  });

  it("rejects unknown role", () => {
    expect(() => roleSchema.parse("SUPERADMIN")).toThrow();
  });

  it("rejects non-uuid user id", () => {
    expect(() =>
      userSchema.parse({ id: "not-a-uuid", email: "u@example.com", role: "DRIVER" })
    ).toThrow();
  });
});
