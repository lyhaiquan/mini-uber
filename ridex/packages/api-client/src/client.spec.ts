import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiClient } from "./client";
import { ApiAuthError } from "./errors";

const responseSchema = z.object({ ok: z.literal(true) });

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

function createClient(fetchImpl: typeof fetch, overrides = {}) {
  return new ApiClient({
    baseUrl: "https://api.test",
    getAccessToken: () => "access-1",
    onRefreshNeeded: async () => "access-2",
    onAuthFailure: vi.fn(),
    fetchImpl,
    timeoutMs: 1_000,
    ...overrides
  });
}

describe("ApiClient", () => {
  it("attaches bearer token and parses a happy path response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true })) as unknown as typeof fetch;
    const client = createClient(fetchImpl);

    await expect(
      client.request({ method: "GET", path: "/rides", schema: responseSchema })
    ).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/rides",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-1" }
      })
    );
  });

  it("refreshes once after a 401 and retries with the new token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHORIZED", message: "expired" } }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true })) as unknown as typeof fetch;
    const onRefreshNeeded = vi.fn(async () => "access-2");
    const client = createClient(fetchImpl, { onRefreshNeeded });

    await expect(
      client.request({ method: "GET", path: "/rides", schema: responseSchema })
    ).resolves.toEqual({ ok: true });

    expect(onRefreshNeeded).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.test/rides",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-2" }
      })
    );
  });

  it("throws ApiAuthError and calls onAuthFailure when refresh returns null", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { code: "UNAUTHORIZED", message: "expired" } }, { status: 401 })
    ) as unknown as typeof fetch;
    const onAuthFailure = vi.fn();
    const client = createClient(fetchImpl, {
      onRefreshNeeded: async () => null,
      onAuthFailure
    });

    await expect(
      client.request({ method: "GET", path: "/rides", schema: responseSchema })
    ).rejects.toBeInstanceOf(ApiAuthError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the retry also returns 401", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ message: "still denied" }, { status: 401 })) as unknown as typeof fetch;
    const onAuthFailure = vi.fn();
    const client = createClient(fetchImpl, { onAuthFailure });

    await expect(
      client.request({ method: "GET", path: "/rides", schema: responseSchema })
    ).rejects.toBeInstanceOf(ApiAuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent refreshes", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === "Bearer access-2") return jsonResponse({ ok: true });
      return jsonResponse({ message: "expired" }, { status: 401 });
    }) as unknown as typeof fetch;
    const onRefreshNeeded = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("access-2"), 10))
    );
    const client = createClient(fetchImpl, { onRefreshNeeded });

    await Promise.all([
      client.request({ method: "GET", path: "/a", schema: responseSchema }),
      client.request({ method: "GET", path: "/b", schema: responseSchema }),
      client.request({ method: "GET", path: "/c", schema: responseSchema })
    ]);

    expect(onRefreshNeeded).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("throws ApiClientError for non-auth error envelopes", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { code: "RIDE_INVALID", message: "Bad ride" } }, { status: 409 })
    ) as unknown as typeof fetch;
    const client = createClient(fetchImpl);

    await expect(
      client.request({ method: "GET", path: "/rides", schema: responseSchema })
    ).rejects.toMatchObject({ status: 409, code: "RIDE_INVALID" });
  });

  it("rejects malformed success responses through the provided schema", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false })) as unknown as typeof fetch;
    const client = createClient(fetchImpl);

    await expect(
      client.request({ method: "GET", path: "/rides", schema: responseSchema })
    ).rejects.toBeInstanceOf(z.ZodError);
  });

  it("proactively refreshes when the token expires within five seconds", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true })) as unknown as typeof fetch;
    const onRefreshNeeded = vi.fn(async () => "access-2");
    const client = createClient(fetchImpl, {
      getAccessTokenExpiresAt: () => Date.now() + 1_000,
      onRefreshNeeded
    });

    await client.request({ method: "GET", path: "/rides", schema: responseSchema });

    expect(onRefreshNeeded).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/rides",
      expect.objectContaining({ headers: { Authorization: "Bearer access-2" } })
    );
  });

  it("fails fast when proactive refresh returns null", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true })) as unknown as typeof fetch;
    const onAuthFailure = vi.fn();
    const client = createClient(fetchImpl, {
      getAccessTokenExpiresAt: () => Date.now() + 1_000,
      onRefreshNeeded: async () => null,
      onAuthFailure
    });

    await expect(
      client.request({ method: "GET", path: "/rides", schema: responseSchema })
    ).rejects.toBeInstanceOf(ApiAuthError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("aborts immediately when caller passes an already-aborted signal", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted === true) {
        throw new DOMException("Aborted before fetch", "AbortError");
      }
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;
    const client = createClient(fetchImpl);

    const controller = new AbortController();
    controller.abort();

    await expect(
      client.request({
        method: "GET",
        path: "/rides",
        schema: responseSchema,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: "AbortError" });

    const lastCall = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const passedInit = lastCall?.[1] as RequestInit;
    expect(passedInit.signal?.aborted).toBe(true);
  });
});
