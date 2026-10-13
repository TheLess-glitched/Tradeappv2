export function isNetworkError(error: unknown): boolean {
  const text = String(
    (error as { message?: string } | null)?.message ?? error ?? "",
  ).toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("network request failed") ||
    text.includes("unknownhost") ||
    text.includes("timeout")
  );
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function friendlyError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isNetworkError(error)) return "No internet connection. Connect and try again.";
  const message = (error as { message?: string } | null)?.message;
  return message && message.length > 0 ? message : fallback;
}