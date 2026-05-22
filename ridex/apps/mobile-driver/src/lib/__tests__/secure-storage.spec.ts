import * as SecureStore from "expo-secure-store";

import { secureStorage, SECURE_STORAGE_KEYS } from "../secure-storage";

describe("secureStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("round-trips set and get", async () => {
    await secureStorage.set("accessToken", "jwt-token");
    const value = await secureStorage.get("accessToken");
    expect(value).toBe("jwt-token");
  });

  it("rejects values larger than 2048 chars", async () => {
    const big = "x".repeat(2049);
    await expect(secureStorage.set("accessToken", big)).rejects.toThrow(/exceeds 2048/);
  });

  it("passes WHEN_UNLOCKED keychain accessibility", async () => {
    await secureStorage.set("refreshToken", "rt");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "refreshToken",
      "rt",
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED })
    );
  });

  it("clear removes all known keys", async () => {
    await secureStorage.set("accessToken", "a");
    await secureStorage.set("refreshToken", "b");
    await secureStorage.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(SECURE_STORAGE_KEYS.length);
  });
});
