#!/usr/bin/env python3
"""
Zo Veilig chatbot knowledge-base sync.

Parses the "faq" blocks (faq1-faq48, faqlt1-faqlt14) out of
templates/page.klantenservice.json -- the live, git-tracked FAQ content
(docs/chatbot-faq-design-2026-09-17.md) -- and upserts them into the
Supabase `chatbot_kb_entries` table (supabase/migrations/009_chatbot_faq.sql),
keyed on source_block_id (the block's own JSON key, e.g. "faq12"). Blocks
that no longer exist in the JSON are marked active=false rather than deleted,
so removed content stays in an audit trail (same convention as
008_webhook_failures.sql).

Deliberately NOT read: sections/faq.liquid's metaobject-based "Uit de
praktijk" cards, or the retired sections/veelgestelde-vragen.liquid -- out
of scope per the design doc.

Only "faq" typed blocks are synced. "note" blocks (e.g. faqlt-note, the
Langer Thuis camera/microphone disclaimer) are NOT rows in the KB table --
the chatbot-faq Edge Function's system prompt carries that disclaimer text
directly, so it's always present regardless of KB content changes.

Requires (Supabase Function secrets, read from the environment -- never
hardcoded or committed):
    SUPABASE_URL                 e.g. https://lfwkpbooieiesuvblvse.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    service role key (bypasses RLS; never the anon key)

Run:
    python3 scripts/sync_chatbot_kb.py            # upsert against SUPABASE_URL
    python3 scripts/sync_chatbot_kb.py --dry-run   # parse + print only, no network/secrets needed
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
KLANTENSERVICE = ROOT / "templates" / "page.klantenservice.json"
TABLE = "chatbot_kb_entries"

# Shopify JSON templates may carry a leading /* ... */ "auto-generated" banner
# comment (see templates/page.oplossingen.json) that isn't valid JSON.
LEADING_COMMENT_RE = re.compile(r"\A\s*/\*.*?\*/\s*", re.DOTALL)


def load_faq_blocks() -> list[dict]:
    raw = KLANTENSERVICE.read_text(encoding="utf-8")
    raw = LEADING_COMMENT_RE.sub("", raw, count=1)
    data = json.loads(raw)

    blocks = data["sections"]["main"]["blocks"]
    order = data["sections"]["main"].get("block_order", list(blocks.keys()))

    entries = []
    for block_id in order:
        block = blocks.get(block_id)
        if block is None or block.get("type") != "faq":
            continue  # skips "note" blocks (faqlt-note) and anything else non-FAQ
        settings = block["settings"]
        entries.append({
            "source_block_id": block_id,
            "category": settings["category"],
            "question": settings["question"],
            "answer": settings["answer"],
            "active": True,
        })
    return entries


def supabase_request(base_url: str, service_role_key: str, path: str, method: str,
                      body: bytes | None = None, extra_headers: dict | None = None) -> bytes:
    req = urllib.request.Request(
        url=f"{base_url}/rest/v1/{path}",
        method=method,
        data=body,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            **(extra_headers or {}),
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"Supabase request failed: {method} {path} -> {e.code}\n{detail}")


def upsert_entries(base_url: str, service_role_key: str, entries: list[dict]) -> None:
    body = json.dumps(entries).encode("utf-8")
    supabase_request(
        base_url, service_role_key,
        f"{TABLE}?on_conflict=source_block_id", "POST", body,
        extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
    )


def fetch_remote_ids(base_url: str, service_role_key: str) -> dict[str, bool]:
    raw = supabase_request(
        base_url, service_role_key,
        f"{TABLE}?select=source_block_id,active", "GET",
    )
    rows = json.loads(raw)
    return {row["source_block_id"]: row["active"] for row in rows}


def deactivate_removed(base_url: str, service_role_key: str, removed_ids: list[str]) -> None:
    if not removed_ids:
        return
    ids = ",".join(removed_ids)
    body = json.dumps({"active": False}).encode("utf-8")
    supabase_request(
        base_url, service_role_key,
        f"{TABLE}?source_block_id=in.({ids})", "PATCH", body,
    )


def count_active(base_url: str, service_role_key: str) -> int:
    raw = supabase_request(
        base_url, service_role_key,
        f"{TABLE}?select=source_block_id&active=eq.true", "GET",
    )
    return len(json.loads(raw))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                         help="Parse the FAQ JSON and print what would be synced; no network calls, no secrets required.")
    args = parser.parse_args()

    entries = load_faq_blocks()
    categories = sorted({e["category"] for e in entries})
    print(f"Parsed {len(entries)} FAQ blocks across {len(categories)} categories from {KLANTENSERVICE.relative_to(ROOT)}")

    if args.dry_run:
        for e in entries:
            print(f"  {e['source_block_id']:10s} [{e['category']}] {e['question'][:70]}")
        print("\nDry run: nothing was sent to Supabase.")
        return 0

    base_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_role_key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in the environment.",
              file=sys.stderr)
        print("(Use the DEV project's values -- see supabase/.env.example for the naming convention. "
              "Never the anon key: this needs the service role key to bypass RLS, same as the Edge Functions.)",
              file=sys.stderr)
        return 1

    local_ids = {e["source_block_id"] for e in entries}
    remote = fetch_remote_ids(base_url, service_role_key)

    upsert_entries(base_url, service_role_key, entries)
    print(f"Upserted {len(entries)} rows (insert-or-update by source_block_id).")

    removed = sorted(rid for rid, active in remote.items() if rid not in local_ids and active)
    deactivate_removed(base_url, service_role_key, removed)
    if removed:
        print(f"Marked {len(removed)} removed block(s) active=false (not deleted): {', '.join(removed)}")

    active_total = count_active(base_url, service_role_key)
    print(f"chatbot_kb_entries active row count: {active_total}")
    if active_total != len(entries):
        print(f"WARNING: active row count ({active_total}) does not match the "
              f"{len(entries)} FAQ blocks just parsed -- check for a partial failure.",
              file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
