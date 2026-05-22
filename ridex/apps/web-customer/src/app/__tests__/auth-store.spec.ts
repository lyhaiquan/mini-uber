import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@/lib/auth-store";

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, status: "idle" });
});

describe("auth-store", () => {
  it("starts idle", () => {
    expect(useAuthStore.getState().status).toBe("idle");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("transitions to authenticated on setAuth", () => {
    useAuthStore
      .getState()
      .setAuth({
        accessToken: "tok",
        user: { id: "11111111-1111-1111-1111-111111111111", email: "a@b.com", role: "CUSTOMER" }
      });
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().accessToken).toBe("tok");
  });

  it("clear wipes state and marks unauthenticated", () => {
    useAuthStore
      .getState()
      .setAuth({
        accessToken: "tok",
        user: { id: "11111111-1111-1111-1111-111111111111", email: "a@b.com", role: "CUSTOMER" }
      });
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
