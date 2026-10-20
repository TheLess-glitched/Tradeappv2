import * as SQLite from "expo-sqlite";
import { isNetworkError } from "./network-error";
import { supabase } from "./supabase";

export type OutboxKind = "job" | "customer";

export type JobPayload = {
  customerName: string | null;
  customerPhone: string | null;
  service: string;
  price: number;
  estimatedFinishAt: string | null; // ISO
  notes: string;
  addCustomer: boolean; // also add this person to Customers if the number is new
};

export type CustomerPayload = {
  name: string;
  phone: string;
  serviceType: string | null;
};

type Base = {
  id: string; // phone-generated; sent to the server as client_id
  businessId: string;
  userId: string;
  occurredAt: string; // ISO time it was made on the phone
  status: "pending" | "needs_attention";
  error: string | null;
  createdAt: number;
};

export type OutboxItem =
  | (Base & { kind: "job"; payload: JobPayload })
  | (Base & { kind: "customer"; payload: CustomerPayload });

type Row = {
  id: string;
  kind: string;
  business_id: string;
  user_id: string;
  payload: string;
  occurred_at: string;
  status: string;
  error: string | null;
  created_at: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("outbox.db");
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          business_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          error TEXT,
          created_at INTEGER NOT NULL
        );`,
      );
      return db;
    })().catch((error) => {
      dbPromise = null; // allow a retry on the next call
      throw error;
    });
  }
  return dbPromise;
}

// Lets screens refresh lists and counts when the outbox changes.
const listeners = new Set<() => void>();

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function toItem(row: Row): OutboxItem {
  const base: Base = {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    occurredAt: row.occurred_at,
    status: row.status === "needs_attention" ? "needs_attention" : "pending",
    error: row.error,
    createdAt: row.created_at,
  };
  const payload = JSON.parse(row.payload);
  return row.kind === "customer"
    ? { ...base, kind: "customer", payload: payload as CustomerPayload }
    : { ...base, kind: "job", payload: payload as JobPayload };
}

async function insert(
  kind: OutboxKind,
  item: {
    id: string;
    businessId: string;
    userId: string;
    occurredAt?: string;
  },
  payload: JobPayload | CustomerPayload,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO outbox
      (id, kind, business_id, user_id, payload, occurred_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      item.id,
      kind,
      item.businessId,
      item.userId,
      JSON.stringify(payload),
      item.occurredAt ?? new Date().toISOString(),
      Date.now(),
    ],
  );
  notify();
}

export function enqueueJob(item: {
  id: string;
  businessId: string;
  userId: string;
  occurredAt?: string;
  payload: JobPayload;
}): Promise<void> {
  return insert("job", item, item.payload);
}

export function enqueueCustomer(item: {
  id: string;
  businessId: string;
  userId: string;
  occurredAt?: string;
  payload: CustomerPayload;
}): Promise<void> {
  return insert("customer", item, item.payload);
}

// Oldest first, so things replay in the order they happened.
export async function listOutbox(
  userId: string,
  businessId: string,
): Promise<OutboxItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM outbox
     WHERE user_id = ? AND business_id = ?
     ORDER BY occurred_at ASC, created_at ASC`,
    [userId, businessId],
  );
  return rows.map(toItem);
}

export async function getOutboxCounts(
  userId: string,
  businessId: string,
): Promise<{ pending: number; needsAttention: number }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM outbox
     WHERE user_id = ? AND business_id = ? GROUP BY status`,
    [userId, businessId],
  );
  let pending = 0;
  let needsAttention = 0;
  rows.forEach((row) => {
    if (row.status === "needs_attention") needsAttention = row.n;
    else pending += row.n;
  });
  return { pending, needsAttention };
}

export async function markOutboxNeedsAttention(
  id: string,
  error: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET status = 'needs_attention', error = ? WHERE id = ?`,
    [error, id],
  );
  notify();
}

export async function retryOutbox(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET status = 'pending', error = NULL WHERE id = ?`,
    [id],
  );
  notify();
}

// Used after a successful sync, and for Discard.
export async function removeOutbox(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [id]);
  notify();
}
type SendError = { message: string; code?: string } | null;

async function sendItem(item: OutboxItem): Promise<SendError> {
  if (item.kind === "customer") {
    const { error } = await supabase.rpc("record_customer_v1", {
      p_client_id: item.id,
      p_name: item.payload.name,
      p_phone: item.payload.phone,
      p_service_type: item.payload.serviceType,
    });
    return error;
  }
  const { error } = await supabase.rpc("record_job_v1", {
    p_client_id: item.id,
    p_customer_name: item.payload.customerName,
    p_customer_phone: item.payload.customerPhone,
    p_service: item.payload.service,
    p_price: item.payload.price,
    p_estimated_finish_at: item.payload.estimatedFinishAt,
    p_notes: item.payload.notes,
    p_occurred_at: item.occurredAt,
    p_offline: true,
    p_add_customer: item.payload.addCustomer,
  });
  return error;
}

const syncsInFlight = new Map<
  string,
  Promise<{ synced: number; needsAttention: number; networkFailure: boolean }>
>();

// Sends pending items oldest first. A network failure stops and leaves
// everything pending; a server rejection moves that item to needs-attention.
export function syncOutbox(
  userId: string,
  businessId: string,
): Promise<{ synced: number; needsAttention: number; networkFailure: boolean }> {
  const key = `${userId}:${businessId}`;
  const existing = syncsInFlight.get(key);
  if (existing) return existing;

  const sync = (async () => {
    let synced = 0;
    let needsAttention = 0;
    let networkFailure = false;
    const items = await listOutbox(userId, businessId);

    for (const item of items) {
      if (item.status !== "pending") continue;
      try {
        const error = await sendItem(item);
        if (error) {
          if (!error.code && isNetworkError(error)) {
            networkFailure = true;
            break;
          }
          await markOutboxNeedsAttention(item.id, error.message);
          needsAttention += 1;
          continue;
        }
        await removeOutbox(item.id);
        synced += 1;
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (!code && isNetworkError(error)) {
          networkFailure = true;
          break;
        }
        await markOutboxNeedsAttention(
          item.id,
          (error as { message?: string })?.message ?? "The server rejected this item.",
        );
        needsAttention += 1;
      }
    }
    return { synced, needsAttention, networkFailure };
  })().finally(() => {
    syncsInFlight.delete(key);
  });
  syncsInFlight.set(key, sync);
  return sync;
}
export async function getUnsyncedOutboxCountForUser(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM outbox WHERE user_id = ?",
    [userId],
  );
  return row?.count ?? 0;
}