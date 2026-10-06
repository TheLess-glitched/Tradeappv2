import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";

export function hashAccountPin(pin: string, accountId: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${accountId}:${pin}`,
  );
}

export async function getAccountPinHash(accountId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("pin_hash")
    .eq("id", accountId)
    .single();

  return { pinHash: data?.pin_hash ?? null, error };
}

export async function verifyAccountPin(
  pin: string,
  accountId: string,
  expectedHash: string,
) {
  return (await hashAccountPin(pin, accountId)) === expectedHash;
}