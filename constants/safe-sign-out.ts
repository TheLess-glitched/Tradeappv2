import NetInfo from "@react-native-community/netinfo";
import { isNetworkError } from "./network-error";
import { supabase } from "./supabase";

const OFFLINE_MESSAGE =
  "Signing out needs an internet connection. Connect and try again. Anything saved on this phone is kept.";

export async function signOutIfOnline(): Promise<{ ok: boolean; message?: string }> {
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) {
    return { ok: false, message: OFFLINE_MESSAGE };
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { ok: false, message: isNetworkError(error) ? OFFLINE_MESSAGE : error.message };
  }
  return { ok: true };
}