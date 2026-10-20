import Storage from "expo-sqlite/kv-store";

// Set to false to switch the cache off without removing any code.
const ENABLED = true;

const PREFIX = "cache_v1:http:";
const MAX_BODY_CHARS = 1000000;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const TIMEOUT_WITH_CACHE_MS = 8000;
const TIMEOUT_WITHOUT_CACHE_MS = 30000;

// RPCs that only read data, so a saved copy is safe to show when offline.
const READ_RPCS = new Set(["list_team", "list_business_members", "revenue_by_day"]);

// Never saved here: the PIN hash lives in secure storage.
const NEVER_CACHE = ["/rest/v1/profiles", "/rest/v1/business_invites"];

type StoredResponse = {
  savedAt: number;
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
};

// Lets the app show a "showing saved data" banner when a saved copy was used.
type StaleListener = (savedAt: number) => void;
const staleListeners = new Set<StaleListener>();

export function subscribeStale(listener: StaleListener): () => void {
  staleListeners.add(listener);
  return () => {
    staleListeners.delete(listener);
  };
}


export async function clearReadCache(): Promise<void> {
  try {
    const keys = (await Storage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    for (const key of keys) await Storage.removeItem(key);
  } catch {
    // best effort
  }
}

function notifyStale(savedAt: number) {
  staleListeners.forEach((listener) => listener(savedAt));
}

function getHeader(headers: HeadersInit | undefined, name: string): string {
  if (!headers) return "";
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? "";
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name);
    return found ? found[1] : "";
  }
  const record = headers as Record<string, string>;
  const foundKey = Object.keys(record).find((key) => key.toLowerCase() === name);
  return foundKey ? record[foundKey] : "";
}

function cacheKeyFor(url: string, method: string, init?: RequestInit): string | null {
  if (!url.includes("/rest/v1/")) return null;
  if (NEVER_CACHE.some((path) => url.includes(path))) return null;

  const accept = getHeader(init?.headers, "accept");
  const prefer = getHeader(init?.headers, "prefer");

  if (method === "GET" || method === "HEAD") {
    return method + "|" + url + "|" + accept + "|" + prefer;
  }
  if (method === "POST") {
    const match = url.match(/\/rest\/v1\/rpc\/([A-Za-z0-9_]+)/);
    if (match && READ_RPCS.has(match[1]) && typeof init?.body === "string") {
      return "RPC|" + url + "|" + init.body + "|" + accept;
    }
  }
  return null;
}

function pickHeaders(headers: Headers): [string, string][] {
  const result: [string, string][] = [];
  ["content-type", "content-range"].forEach((name) => {
    const value = headers.get(name);
    if (value) result.push([name, value]);
  });
  return result;
}

async function load(key: string): Promise<StoredResponse | null> {
  try {
    const raw = await Storage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredResponse;
    if (Date.now() - entry.savedAt > MAX_AGE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

async function store(key: string, response: Response): Promise<void> {
  try {
    if (response.status !== 200 && response.status !== 206) return;
    const body = await response.text();
    if (body.length > MAX_BODY_CHARS) return;
    const entry: StoredResponse = {
      savedAt: Date.now(),
      status: response.status,
      statusText: response.statusText,
      headers: pickHeaders(response.headers),
      body,
    };
    await Storage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // saving a copy is best effort
  }
}

let pruneScheduled = false;

async function pruneOldEntries(): Promise<void> {
  try {
    const keys = (await Storage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    for (const key of keys) {
      const raw = await Storage.getItem(key);
      if (!raw) continue;
      try {
        const entry = JSON.parse(raw) as StoredResponse;
        if (Date.now() - entry.savedAt > MAX_AGE_MS) await Storage.removeItem(key);
      } catch {
        await Storage.removeItem(key);
      }
    }
  } catch {
    // best effort
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort());
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function cachingFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!ENABLED) return fetch(input, init);

  const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const key = cacheKeyFor(url, method, init);
  if (!key) return fetch(input, init);

  if (!pruneScheduled) {
    pruneScheduled = true;
    setTimeout(() => void pruneOldEntries(), 15000);
  }

  const cached = await load(key);
  try {
    // With a saved copy, give up after 8 seconds; without one, wait longer.
    const response = await fetchWithTimeout(
      input,
      init,
      cached ? TIMEOUT_WITH_CACHE_MS : TIMEOUT_WITHOUT_CACHE_MS,
    );
    if (response.ok) void store(key, response.clone());
    return response;
  } catch (error) {
    if (cached) {
      notifyStale(cached.savedAt);
      return new Response(method === "HEAD" ? null : cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
      });
    }
    throw error;
  }
}
