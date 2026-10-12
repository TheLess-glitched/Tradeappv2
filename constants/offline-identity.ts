import AsyncStorage from "@react-native-async-storage/async-storage";

export type OfflineIdentity = {
  userId: string;
  businessId: string | null;
  role: "owner" | "worker" | null;
  savedAt: string;
};

const KEY = "offline_identity_v1";

export async function saveOfflineIdentity(identity: OfflineIdentity) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // best effort
  }
}

export async function loadOfflineIdentity(): Promise<OfflineIdentity | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineIdentity) : null;
  } catch {
    return null;
  }
}

export async function clearOfflineIdentity() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best effort
  }
}