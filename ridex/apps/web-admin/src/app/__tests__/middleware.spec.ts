import { describe, expect, it } from "vitest";

import { resolveAuthRedirect } from "../../middleware";

describe("resolveAuthRedirect", () => {
  it("allows public routes without cookies", () => {
    expect(resolveAuthRedirect("/login", undefined, undefined)).toBeNull();
  });

  it("redirects protected routes to /login when refresh cookie is missing", () => {
    expect(resolveAuthRedirect("/dashboard", undefined, undefined)).toBe("/login");
  });

  it("redirects protected routes to /403 when role cookie is non-admin", () => {
    expect(resolveAuthRedirect("/dashboard", "refresh-token", "CUSTOMER")).toBe("/403");
  });

  it("allows protected routes for ADMIN sessions", () => {
    expect(resolveAuthRedirect("/dashboard", "refresh-token", "ADMIN")).toBeNull();
  });

  it("allows older protected sessions with refresh cookie but no role cookie", () => {
    expect(resolveAuthRedirect("/dashboard", "refresh-token", undefined)).toBeNull();
  });
});
