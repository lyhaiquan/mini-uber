import { describe, expect, it, vi } from "vitest";

import {
  clearRefreshCookie,
  clearRoleCookie,
  REFRESH_COOKIE_NAME,
  ROLE_COOKIE_NAME,
  setRefreshCookie,
  setRoleCookie
} from "../auth-cookie";

interface CookieJarMock {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  getAll: ReturnType<typeof vi.fn>;
  has: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

describe("auth-cookie helpers", () => {
  it("writes refresh and role cookies with the expected names", () => {
    const cookies: CookieJarMock = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
      delete: vi.fn()
    };

    setRefreshCookie(cookies, "refresh-1");
    setRoleCookie(cookies, "ADMIN");

    expect(cookies.set).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "refresh-1",
      expect.objectContaining({ httpOnly: true, path: "/" })
    );
    expect(cookies.set).toHaveBeenCalledWith(
      ROLE_COOKIE_NAME,
      "ADMIN",
      expect.objectContaining({ httpOnly: true, path: "/" })
    );
  });

  it("clears refresh and role cookies", () => {
    const cookies: CookieJarMock = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
      delete: vi.fn()
    };

    clearRefreshCookie(cookies);
    clearRoleCookie(cookies);

    expect(cookies.set).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
    expect(cookies.set).toHaveBeenCalledWith(
      ROLE_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });
});
