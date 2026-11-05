const URL_ = process.env.MYU_FUNCTION_URL;

export type EdgeResult<T = Record<string, any>> = { ok: boolean; status: number; data: T & { error?: string } }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Call the seller-form edge function (server side only). The seller's private link token is the credential. */
export async function edge<T = Record<string, any>>(action: string, token: string, extra: Record<string, unknown> = {}): Promise<EdgeResult<T>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!URL_) throw new Error("MYU_FUNCTION_URL is not set");
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token, ...extra }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: "Bad response" }));
  return { ok: res.ok, status: res.status, data };
}
