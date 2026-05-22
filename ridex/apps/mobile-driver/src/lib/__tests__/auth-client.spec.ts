import { authClient } from "../auth-client";
import { secureStorage } from "../secure-storage";

const fetchMock = jest.fn();
(global as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;

const validTokens = {
  accessToken: "access-token-value",
  refreshToken: "x".repeat(80),
  accessTokenExpiresInSeconds: 900,
  user: { id: "11111111-1111-1111-1111-111111111111", email: "a@b.com", role: "CUSTOMER" }
};

beforeEach(async () => {
  fetchMock.mockReset();
  await secureStorage.clear();
});

describe("authClient.login", () => {
  it("persists tokens to secure storage on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(validTokens)
    });
    const result = await authClient.login({ email: "a@b.com", password: "abc" });
    expect(result.ok).toBe(true);
    expect(await secureStorage.get("accessToken")).toBe("access-token-value");
    expect(await secureStorage.get("refreshToken")).toBe(validTokens.refreshToken);
    expect(await secureStorage.get("userRole")).toBe("CUSTOMER");
  });

  it("returns server error message without writing tokens", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ message: "Sai mật khẩu" })
    });
    const result = await authClient.login({ email: "a@b.com", password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Sai mật khẩu");
    expect(await secureStorage.get("accessToken")).toBeNull();
  });

  it("handles network failure gracefully", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const result = await authClient.login({ email: "a@b.com", password: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Không kết nối được máy chủ");
  });
});

describe("authClient.logout", () => {
  it("clears secure storage even if backend fails", async () => {
    await secureStorage.set("refreshToken", "x".repeat(80));
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await authClient.logout();
    expect(await secureStorage.get("refreshToken")).toBeNull();
  });
});
