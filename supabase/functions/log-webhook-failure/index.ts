// log-webhook-failure
//
// Makes a failed ZV_LEAD_ENDPOINT send (Vista, camera-hardware "Neem contact op",
// Veilig Onderweg "Binnenkort beschikbaar" — assets/zv-lead-webhook.js) visible instead
// of disappearing into an empty client-side .catch(). See
// docs/lead-endpoint-diagnosis-2026-09-15.md for the incident that motivated this, and
// docs/lead-webhook-failure-logging-2026-09-15.md for the design and its limits.
//
// Writes one `webhook_failures` row, using the service role, and stops. No lead PII is
// accepted or stored here — this is a diagnostic trail, not a second copy of lead data.
//
// Required env (Supabase Function secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — auto-injected by the platform.
//   ALLOWED_ORIGINS — same convention as capture-lead (comma-separated storefront
//   origins allowed to call this).

import { createClient } from "jsr:@supabase/supabase-js@2";

const SOURCE_CODES = ["vista", "camera_hardware", "onderweg_coming_soon"];
const ERROR_TYPE_CODES = ["network_error", "timeout", "exception"];

function allowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = allowedOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const source = str(payload.source);
  const errorType = str(payload.error_type);

  if (!SOURCE_CODES.includes(source) || !ERROR_TYPE_CODES.includes(errorType)) {
    return jsonResponse({ ok: false, error: "invalid_fields" }, 400, origin);
  }

  const endpointHost = str(payload.endpoint_host) || null;
  const errorMessage = str(payload.error_message).slice(0, 500) || null;
  const occurredAtRaw = str(payload.occurred_at);
  const occurredAt = occurredAtRaw && !Number.isNaN(Date.parse(occurredAtRaw))
    ? occurredAtRaw
    : new Date().toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: insertError } = await supabase.from("webhook_failures").insert({
    source,
    endpoint_host: endpointHost,
    error_type: errorType,
    error_message: errorMessage,
    occurred_at: occurredAt,
  });

  if (insertError) {
    console.error("log-webhook-failure: insert failed", insertError);
    return jsonResponse({ ok: false, error: "insert_failed" }, 500, origin);
  }

  return jsonResponse({ ok: true }, 200, origin);
});
