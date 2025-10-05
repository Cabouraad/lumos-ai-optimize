"use client";
import { useEffect, useState } from "react";
import { invokeEdge } from "@/lib/supabase/invoke";

export default function EdgeHealthBadge() {
  const [msg, setMsg] = useState<string>("checking...");
  
  useEffect(() => {
    (async () => {
      const r = await invokeEdge("enqueue-optimizations", { body: { scope: "noop" }, timeoutMs: 5000 });
      setMsg(r.error ? `fn unreachable: ${r.error.message}` : "edge reachable");
    })();
  }, []);
  
  return (
    <div className="text-[11px] rounded px-2 py-1 border border-zinc-700 text-zinc-300">
      Edge: {msg}
    </div>
  );
}
