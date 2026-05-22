import { afterEach, describe, expect, it, vi } from "vitest";

import { callBackend, flattenBackendError } from "@/lib/auth-proxy";

const fetchMock = vi.spyOn(globalThis, "fetch");

afterEach(() => {
  fetchMock.mockReset();
});

describe("callBackend", () => {
  it("returns parsed JSON on 200", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: "a" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const result = await callBackend<{ accessToken: string }>({
      path: "/auth/login",
      body: { email: "e", password: "p" }
    });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ accessToken: "a" });
  });

  it("falls back to wrapping string body when JSON parse fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("plain-error", { status: 500 }));
    const result = await callBackend<unknown>({ path: "/auth/login", body: {} });
    expect(result.status).toBe(500);
    expect(result.json).toEqual({ message: "plain-error" });
  });
});

describe("flattenBackendError", () => {
  it("joins array messages", () => {
    expect(flattenBackendError({ message: ["a", "b"] })).toBe("a, b");
  });
  it("returns string message verbatim", () => {
    expect(flattenBackendError({ message: "Sai mật khẩu" })).toBe("Sai mật khẩu");
  });
  it("returns fallback for null body", () => {
    expect(flattenBackendError(null)).toBe("Yêu cầu thất bại");
  });
});
