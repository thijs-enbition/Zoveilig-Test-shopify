// capture-lead
//
// Secure server-side boundary for storefront lead capture (ADR-002/003/007).
// Scoped, for now, to the Contact page's "Plan een gratis adviesgesprek" form
// (sections/contact-page.liquid) — writes one `leads` row + one `status_history`
// row, using the service role, and stops there.
//
// Explicitly NOT done here (see docs/architecture/adr/ADR-004-odoo-deferred-phase-2.md):
// no Odoo call. `leads.odoo_sync_status` is left at its `not_ready` default;
// Phase 2 reads leads with that status and does the sync.
//
// Required env (Supabase Function secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — auto-injected by the platform.
//   ALLOWED_ORIGINS — comma-separated storefront origins allowed to call this
//   (DEV_ALLOWED_ORIGINS / PROD_ALLOWED_ORIGINS in supabase/.env.example feed this
//   per environment).

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUBJECT_CODES = [
  "advies",
  "langer_thuis",
  "mijn_thuis",
  "veilig_onderweg",
  "zakelijk",
  "bestaand_klant",
];
const CONTACT_TIME_CODES = ["any", "morning", "afternoon", "evening"];

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
    "Access-Control-Allow-Headers": "content-type",
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

  // Honeypot: real visitors never fill this hidden field.
  if (str(payload.website) !== "") {
    return jsonResponse({ ok: false, error: "rejected" }, 400, origin);
  }

  const naam = str(payload.Naam);
  const telefoon = str(payload.Telefoon);
  const email = str(payload.email);

  if (!naam || !telefoon || !email || !email.includes("@")) {
    return jsonResponse({ ok: false, error: "missing_required_fields" }, 400, origin);
  }

  const onderwerp = str(payload.Onderwerp);
  const voorkeurstijd = str(payload.Voorkeurstijd);
  const bericht = str(payload.body);
  const bron = str(payload.Bron) || "Contactpagina";

  const subject = SUBJECT_CODES.includes(onderwerp) ? onderwerp : null;
  const preferredContactTime = CONTACT_TIME_CODES.includes(voorkeurstijd) ? voorkeurstijd : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert({
      first_name: naam,
      phone: telefoon,
      email: email,
      preferred_contact_method: "phone",
      status: "contact_requested",
      source: bron,
      subject: subject,
      preferred_contact_time: preferredContactTime,
      message: bericht || null,
    })
    .select("id, lead_reference")
    .single();

  if (insertError || !lead) {
    console.error("capture-lead: insert failed", insertError);
    return jsonResponse({ ok: false, error: "insert_failed" }, 500, origin);
  }

  const { error: historyError } = await supabase.from("status_history").insert({
    entity_type: "lead",
    entity_id: lead.id,
    previous_status: null,
    new_status: "contact_requested",
    changed_by: "capture-lead",
    metadata: { source: bron },
  });

  if (historyError) {
    // Non-fatal: the lead itself is saved; log for follow-up rather than
    // failing a request the visitor already sees as submitted.
    console.error("capture-lead: status_history insert failed", historyError);
  }

  return jsonResponse({ ok: true, lead_reference: lead.lead_reference }, 200, origin);
});
