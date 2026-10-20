import * as SQLite from "expo-sqlite";
import { isNetworkError } from "./network-error";
import { getUnsyncedOutboxCountForUser } from "./outbox";
import { supabase } from "./supabase";

export type QueuedLine = {
  catalogue_item_id: string;
  quantity: number;
  unit_price: number;
  name: string;
};

export type QueuedSale = {
  id: string; // phone-generated; becomes sale_group_id on the server
  businessId: string;
  userId: string;
  lines: QueuedLine[];
  reason: string;
  occurredAt: string; // ISO time the sale was made on the phone
  status: "pending" | "needs_attention";
  error: string | null;
  createdAt: number;
};

type Row = {
  id: string;
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
      const db = await SQLite.openDatabaseAsync("sale-queue.db");
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS sale_queue (
          id TEXT PRIMARY KEY NOT NULL,
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

// Lets screens refresh counts and lists when the queue changes.
const listeners = new Set<() => void>();

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function toSale(row: Row): QueuedSale {
  const payload = JSON.parse(row.payload) as { lines: QueuedLine[]; reason?: string };
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    lines: payload.lines,
    reason: payload.reason ?? "Sale",
    occurredAt: row.occurred_at,
    status: row.status === "needs_attention" ? "needs_attention" : "pending",
    error: row.error,
    createdAt: row.created_at,
  };
}

export async function enqueueSale(sale: {
  id: string;
  businessId: string;
  userId: string;
  lines: QueuedLine[];
  reason?: string;
  occurredAt?: string;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO sale_queue
      (id, business_id, user_id, payload, occurred_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [
      sale.id,
      sale.businessId,
      sale.userId,
      JSON.stringify({ lines: sale.lines, reason: sale.reason ?? "Sale" }),
      sale.occurredAt ?? new Date().toISOString(),
      Date.now(),
    ],
  );
  notify();
}

// Oldest sale first, so stock and alerts replay in the order things happened.
export async function listQueuedSales(
  userId: string,
  businessId: string,
): Promise<QueuedSale[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM sale_queue
     WHERE user_id = ? AND business_id = ?
     ORDER BY occurred_at ASC, created_at ASC`,
    [userId, businessId],
  );
  return rows.map(toSale);
}

export async function listQueuedSalesForUser(userId: string): Promise<QueuedSale[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM sale_queue
     WHERE user_id = ?
     ORDER BY occurred_at ASC, created_at ASC`,
    [userId],
  );
  return rows.map(toSale);
}

export async function getPendingQuantities(
  userId: string,
  businessId: string,
): Promise<Record<string, number>> {
  const sales = await listQueuedSales(userId, businessId);
  const quantities: Record<string, number> = {};
  for (const sale of sales) {
    if (sale.status !== "pending") continue;
    for (const line of sale.lines) {
      quantities[line.catalogue_item_id] =
        (quantities[line.catalogue_item_id] ?? 0) + line.quantity;
    }
  }
  return quantities;
}

export async function getQueueCounts(
  userId: string,
  businessId: string,
): Promise<{ pending: number; needsAttention: number }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM sale_queue
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

export async function getUnsyncedSalesCountForUser(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sale_queue WHERE user_id = ?",
    [userId],
  );
  return (row?.count ?? 0) + (await getUnsyncedOutboxCountForUser(userId));
}

const syncsInFlight = new Map<string, Promise<{
  synced: number;
  needsAttention: number;
  networkFailure: boolean;
}>>();

export function syncQueuedSales(
  userId: string,
  businessId: string,
): Promise<{ synced: number; needsAttention: number; networkFailure: boolean }> {
  const key = `${userId}:${businessId}`;
  const existingSync = syncsInFlight.get(key);
  if (existingSync) return existingSync;

  const sync = (async () => {
    let synced = 0;
    let needsAttention = 0;
    let networkFailure = false;
    const sales = await listQueuedSales(userId, businessId);

    for (const sale of sales) {
      if (sale.status !== "pending") continue;
      try {
        const { error } = await supabase.rpc("record_sale_cart_v2", {
            p_client_id: sale.id,
            p_lines: sale.lines.map((line) => ({
                catalogue_item_id: line.catalogue_item_id,
                quantity: line.quantity,
                unit_price: line.unit_price,
                name: line.name,
            })),
            p_reason: sale.reason,
            p_occurred_at: sale.occurredAt,
            p_offline: true,
        });
        if (error) {
          const code = (error as { code?: string }).code;
          if (!code && isNetworkError(error)) {
            networkFailure = true;
            break;
          }
          await markNeedsAttention(sale.id, error.message);
          needsAttention += 1;
          continue;
        }
        await removeSale(sale.id);
        synced += 1;
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (!code && isNetworkError(error)) {
          networkFailure = true;
          break;
        }
        await markNeedsAttention(
          sale.id,
          (error as { message?: string })?.message ?? "The server rejected this sale.",
        );
        needsAttention += 1;
        continue;
      }
    }

    return { synced, needsAttention, networkFailure };
  })().finally(() => {
    syncsInFlight.delete(key);
  });
  syncsInFlight.set(key, sync);
  return sync;
}

export async function markNeedsAttention(id: string, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sale_queue SET status = 'needs_attention', error = ? WHERE id = ?`,
    [error, id],
  );
  notify();
}

export async function retrySale(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sale_queue SET status = 'pending', error = NULL WHERE id = ?`,
    [id],
  );
  notify();
}

// Used after a successful sync, and for Discard.
export async function removeSale(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM sale_queue WHERE id = ?`, [id]);
  notify();
}