import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://carry-the-boats.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : "https://carry-the-boats.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "content-type, x-recovery-key",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
}

async function syncIdFromKey(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers });
  }

  const recoveryKey = req.headers.get("x-recovery-key") ?? "";
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(recoveryKey)) {
    return new Response(JSON.stringify({ error: "invalid_recovery_key" }), { status: 401, headers });
  }

  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const secretKey = secretKeys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secretKey) {
    return new Response(JSON.stringify({ error: "server_not_configured" }), { status: 500, headers });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const syncId = await syncIdFromKey(recoveryKey);

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("private_sync_state")
      .select("payload, client_updated_at, updated_at")
      .eq("sync_id", syncId)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: "read_failed" }), { status: 500, headers });
    }
    if (!data) {
      return new Response(JSON.stringify({ found: false }), { status: 404, headers });
    }

    return new Response(JSON.stringify({
      found: true,
      payload: data.payload,
      updatedAt: Number(data.client_updated_at || 0),
      serverUpdatedAt: data.updated_at
    }), { headers });
  }

  if (req.method === "PUT") {
    const raw = await req.text();
    if (raw.length > 1_500_000) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), { status: 413, headers });
    }

    let body: { payload?: unknown; updatedAt?: number };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
    }

    if (!body.payload || typeof body.updatedAt !== "number" || !Number.isFinite(body.updatedAt)) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers });
    }

    const { error } = await admin
      .from("private_sync_state")
      .upsert({
        sync_id: syncId,
        payload: body.payload,
        client_updated_at: Math.trunc(body.updatedAt),
        updated_at: new Date().toISOString()
      }, { onConflict: "sync_id" });

    if (error) {
      return new Response(JSON.stringify({ error: "write_failed" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ ok: true, updatedAt: Math.trunc(body.updatedAt) }), { headers });
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
});
