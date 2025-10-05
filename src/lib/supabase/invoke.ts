"use client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type InvokeOptions = {
  body?: any;
  path?: string;
  timeoutMs?: number;
};

export async function invokeEdge(functionName: string, opts: InvokeOptions = {}) {
  const sb = getSupabaseBrowserClient();

  const url = import.meta.env.VITE_SUPABASE_URL || "https://cgocsffxqyhojtyzniyz.supabase.co";
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  
  if (!url || !anon) {
    return { data: null, error: new Error("Supabase env missing (URL or ANON).") };
  }

  const { data: sess } = await sb.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) return { data: null, error: new Error("Unauthenticated. Please sign in.") };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };

  try {
    const { data, error } = await sb.functions.invoke(functionName, {
      body: opts.body ?? {},
      headers,
    });
    if (error) return { data: null, error: new Error(error.message || "invoke failed") };
    return { data, error: null };
  } catch (_) {
    // fall through
  }

  try {
    const endpoint = opts.path || `${url.replace(/\/$/, "")}/functions/v1/${functionName}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 30000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(opts.body ?? {}),
      signal: ctl.signal,
      mode: "cors",
      credentials: "omit",
    });

    clearTimeout(timer);

    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text();

    if (!res.ok) {
      const detail =
        typeof payload === "string"
          ? payload
          : payload?.detail || payload?.error || `HTTP ${res.status}`;
      const e = new Error(`HTTP ${res.status}: ${detail}`);
      (e as any).status = res.status;
      (e as any).response = payload;
      return { data: null, error: e };
    }
    return { data: payload, error: null };
  } catch (e: any) {
    const err = new Error(`Network error calling edge: ${e?.message || e}`);
    (err as any).status = 0;
    return { data: null, error: err };
  }
}
