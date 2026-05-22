import * as SecureStore from "expo-secure-store";

const KEYS = ["accessToken", "refreshToken", "userId", "userRole"] as const;
export type StorageKey = (typeof KEYS)[number];

const MAX_VALUE_LENGTH = 2048;

export const secureStorage = {
  async get(key: StorageKey): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async set(key: StorageKey, value: string): Promise<void> {
    if (value.length > MAX_VALUE_LENGTH) {
      throw new Error(`secure-storage: value for "${key}" exceeds ${MAX_VALUE_LENGTH} chars`);
    }
    return SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED
    });
  },
  async remove(key: StorageKey): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
  async clear(): Promise<void> {
    await Promise.all(KEYS.map((k) => SecureStore.deleteItemAsync(k)));
  }
};

export const SECURE_STORAGE_KEYS = KEYS;
