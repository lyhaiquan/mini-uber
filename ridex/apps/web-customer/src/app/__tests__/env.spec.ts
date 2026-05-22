import { describe, expect, it } from "vitest";

describe("env (smoke)", () => {
  it("falls back to localhost defaults when env vars are missing", async () => {
    const { env } = await import("../../lib/env");
    expect(env.NEXT_PUBLIC_API_BASE_URL).toMatch(/^https?:\/\//);
    expect(env.NEXT_PUBLIC_WS_URL).toMatch(/^https?:\/\//);
  });
});
