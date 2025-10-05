"use client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type InvokeOptions = {
  body?: any;
  path?: string; // optional explicit path to edge fn; default /functions/v1/<fn>
  timeoutMs?: number;
};

/**
 * invokeEdge() — preferred way to call Supabase edge functions from the browser.
 * 1) fetches session token
 * 2) tries supabase.functions.invoke with explicit Authorization header
 * 3) if that throws (CORS/misrouting), falls back to direct fetch to /functions/v1/<fn>
 * Always returns { data, error } like supabase.functions.invoke.
 */
export async function invokeEdge(functionName: string, opts: InvokeOptions = {}) {
  const sb = getSupabaseBrowserClient();

  // Get Supabase URL - try multiple env variable names
  const url = import.meta.env.VITE_SUPABASE_URL || "https://cgocsffxqyhojtyzniyz.supabase.co";
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  
  if (!url || !anon) {
    return { data: null, error: new Error("Supabase env missing (URL or ANON key).") };
  }

  const { data: sess } = await sb.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) return { data: null, error: new Error("Unauthenticated. Please sign in.") };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "authorization": `Bearer ${token}`,
  };

  // 1) Try functions.invoke with explicit header
  try {
    const { data, error } = await sb.functions.invoke(functionName, {
      body: opts.body ?? {},
      headers, // explicitly pass token to avoid silent 401
    });
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (e: any) {
    // fallthrough to direct fetch
  }

  // 2) Direct fetch fallback (helps when invoke path is blocked in preview/host)
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

    // Always try json; if not, bubble text
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      return { data: null, error: new Error(typeof payload === "string" ? payload : (payload?.detail || `HTTP ${res.status}`)) };
    }
    return { data: payload, error: null };
  } catch (e: any) {
    return { data: null, error: new Error(`Network error calling edge function: ${e?.message || e}`) };
  }
}
