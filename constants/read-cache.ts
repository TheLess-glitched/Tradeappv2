import AsyncStorage from "@react-native-async-storage/async-storage";
import Storage from "expo-sqlite/kv-store";
import { withTimeout } from "./network-error";

const PREFIX = "cache_v1:";

type CacheEntry<T> = { savedAt: string; data: T };

export type CachedResult<T> = {
  data: T;
  savedAt: string | null; // null means fresh from the server
};

export async function saveCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { savedAt: new Date().toISOString(), data };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // best effort
  }
}

export async function loadCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

export async function clearAllCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((key) => key.startsWith(PREFIX));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    // best effort
  }
  try {
    const keys = await Storage.getAllKeys();
    const mine = keys.filter((key) => key.startsWith(PREFIX));
    await Promise.all(mine.map((key) => Storage.removeItem(key)));
  } catch {
    // best effort
  }
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => PromiseLike<{ data: T | null; error: unknown }>,
  timeoutMs = 5000,
): Promise<CachedResult<T>> {
  try {
    const result = await withTimeout(fetcher(), timeoutMs);
    if (result.error) throw result.error;
    if (result.data == null) throw new Error("empty response");
    void saveCache(key, result.data);
    return { data: result.data, savedAt: null };
  } catch (error) {
    const cached = await loadCache<T>(key);
    if (cached) return { data: cached.data, savedAt: cached.savedAt };
    throw error;
  }
}
