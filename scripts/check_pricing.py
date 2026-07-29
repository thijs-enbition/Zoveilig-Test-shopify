#!/usr/bin/env python3
"""
Zo Veilig pricing checks. Exits non-zero on failure so it can gate CI.

Covers the required checks:
  1 monthly price consistency
  2 activation price consistency
  3 initial payment calculation
  4 contract duration
  5 indicative contract value (no period counted twice)
  6 add-on prices
  7 analytics purchase value

Plus two guards that enforce the single source of truth:
  8 no retired or superseded value appears anywhere
  9 no theme file carries an independent price or duration

Run:  python3 check_pricing.py
"""

from decimal import Decimal, ROUND_HALF_UP
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PRICING = ROOT / "pricing"
# Theme lives at the repository root, so scanning is restricted to the recognised
# Shopify theme directories. Scanning ROOT itself would pull in docs/ and scripts/
# and produce false positives on prices quoted in documentation.
THEME_DIRS = ["assets", "config", "layout", "locales", "sections", "snippets", "templates"]
cfg = json.loads((PRICING / "pricing.config.json").read_text(encoding="utf-8"))
gen = json.loads((PRICING / "pricing.generated.json").read_text(encoding="utf-8"))

failures: list[str] = []
warnings: list[str] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    if ok:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}  {detail}")
        failures.append(f"{label} {detail}".strip())


def half_up(v: Decimal) -> int:
    return int(v.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


cfg_monthly: dict[str, int] = {}
for line in cfg["lines"]:
    for p in line["packages"]:
        pr = p["monthlyRecurringPrice"]
        if "amountCents" in pr:
            cfg_monthly[p["id"]] = pr["amountCents"]

priced = [p for p in gen["packages"] if p.get("purchasable")]
activation = cfg["activation"]["amountCents"]
multiplier = Decimal(str(cfg["commitment"]["multiplier"]))

print("\n1. Monthly price consistency (single source of truth)")
for p in priced:
    check(p["monthlyRecurringPriceCents"] == cfg_monthly[p["id"]],
          f"{p['name']} monthly matches central config",
          f"generated={p['monthlyRecurringPriceCents']} config={cfg_monthly[p['id']]}")
# Provisional prices are NOT asserted against a hard-coded amount list. Only the
# single-source link (generated == config) is enforced above. Non-Onderweg package
# prices carry pricingStatus CURRENT_WORKING and remain provisional until they are
# commercially confirmed; asserting fixed cent values here would fail CI whenever a
# provisional price is legitimately updated. Commercial status is reported in check 10.
for p in priced:
    check(bool(p["monthlyRecurringPriceCents"]) and p["monthlyRecurringPriceCents"] > 0,
          f"{p['name']} carries a positive provisional price",
          f"status={p.get('pricingStatus')} cents={p['monthlyRecurringPriceCents']}")

print("\n2. Activation price consistency")
check(activation == 4900, "activation is EUR 49,00", f"got {activation}")
check(len({p["activationPriceCents"] for p in priced}) == 1,
      "one activation value across all packages")
check(all(p["activationPriceCents"] == activation for p in priced),
      "every package uses the central activation value")

print("\n3. Initial payment calculation")
for p in priced:
    m = p["monthlyRecurringPriceCents"]
    exp_commit = half_up(Decimal(m) * multiplier)
    exp_due = activation + exp_commit
    check(p["initialCommitmentAmountCents"] == exp_commit,
          f"{p['name']} commitment = 1.5 x monthly (half-up)",
          f"got {p['initialCommitmentAmountCents']} expected {exp_commit}")
    check(p["initialPaymentDueTodayCents"] == exp_due,
          f"{p['name']} due today = activation + commitment",
          f"got {p['initialPaymentDueTodayCents']} expected {exp_due}")
# guard the rounding mode itself
check(half_up(Decimal("3742.5")) == 3743,
      "rounding is half-up, not banker's", "1.5 x 2495 must give 3743")
check(cfg["rounding"]["method"] == "ROUND_HALF_UP", "config declares ROUND_HALF_UP")

print("\n4. Contract duration")
check(cfg["contract"]["defaultTermMonths"] == 36, "default term is 36 months")
enabled = [o["months"] for o in cfg["contract"]["options"] if o["enabled"]]
check(enabled == [36], "only 36 months is commercially enabled", f"enabled={enabled}")
check(all(o["months"] in (12, 24, 36) for o in cfg["contract"]["options"]),
      "12, 24 and 36 are all supported by the model")
for p in priced:
    check(p["termMonths"] in enabled,
          f"{p['name']} term is commercially enabled", f"got {p['termMonths']}")

print("\n5. Indicative contract value")
for p in priced:
    m = p["monthlyRecurringPriceCents"]
    icv = p["indicativeContractValue"]
    credited = icv["methods"]["credited"]
    separate = icv["methods"]["separate"]
    # credited must not double count: months billed + 1.5 prepaid == term
    check(abs(credited["recurringMonthsBilled"] + float(multiplier) - p["termMonths"]) < 1e-9,
          f"{p['name']} credited method counts no period twice",
          f"billed={credited['recurringMonthsBilled']} + 1.5 != {p['termMonths']}")
    exp_sep = activation + p["initialCommitmentAmountCents"] + m * p["termMonths"]
    check(separate["cents"] == exp_sep, f"{p['name']} separate method arithmetic",
          f"got {separate['cents']} expected {exp_sep}")
    check(separate["cents"] > credited["cents"],
          f"{p['name']} separate exceeds credited (sanity)")
    check(icv["status"] == "UNRESOLVED_PENDING_ODOO",
          f"{p['name']} ICV flagged unresolved until Odoo confirms")
check(cfg["commitment"]["creditTreatment"]["selected"] is None,
      "no credit treatment silently selected")

print("\n6. Add-on prices")
addons = {a["id"]: a for a in gen["addons"]}
check(addons["alarmcom-domotica"]["priceCents"] == 400,
      "Domotica is EUR 4,00", f"got {addons['alarmcom-domotica']['priceCents']}")
onz = addons["ontzorgpakket"]
check(onz["purchasable"] is False, "Ontzorgpakket is not purchasable")
check(onz["priceCents"] is None, "Ontzorgpakket carries no amount",
      f"got {onz['priceCents']}")
check(onz["display"] == cfg["labels"]["pricePending"],
      "Ontzorgpakket shows 'Prijs volgt'")
bundles = {b["id"]: b for b in gen["bundles"]}
check(bundles["camera-deurbel"]["priceWasCents"] == 1990
      and bundles["camera-deurbel"]["priceWasVerified"],
      "Camera + Deurbel keeps its verified was-price")
for bid in ("volledig-gerust", "zorg-opvolging"):
    check(bundles[bid]["priceWasCents"] is None,
          f"{bid} has no unverified was-price")

print("\n7. Analytics purchase value")
ta = cfg["tracking"]["momentA"]
check(ta["valueSource"] == "initialPaymentDueToday",
      "Moment A value is initialPaymentDueToday")
for p in priced:
    check(p["initialPaymentDueTodayCents"] == activation + p["initialCommitmentAmountCents"],
          f"{p['name']} Moment A equals what Shopify collects")
for param in ("monthlyRecurringPrice", "indicativeContractValue"):
    check(param in ta["extraParams"], f"Moment A sends {param} as a separate parameter")
check(cfg["tracking"]["momentB"]["valueSource"] == "indicativeContractValue",
      "Moment B value is indicativeContractValue")
check(cfg["tracking"]["momentB"]["status"] == "BLOCKED_PENDING_ODOO",
      "Moment B marked blocked until Odoo confirms")

print("\n8. Retired and superseded values absent")
scan_files = [p for d in THEME_DIRS for p in (ROOT / d).rglob("*")
              if p.is_file() and p.suffix in {".liquid", ".json", ".css", ".js"}
              and "zv-pricing.liquid" not in p.name]
blob = "\n".join(f.read_text(encoding="utf-8", errors="ignore") for f in scan_files)
retired_patterns = {
    "Familie Plus": r"Familie\s*Plus",
    "EUR 99,00 activation": r"99,00",
    "EUR 73,95 cart total": r"73,95",
    "Domotica 4,95": r"€\s*4,95",
    "Pakketactivatie label": r"Pakketactivatie",
    "Totaal over looptijd label": r"Totaal over looptijd",
}
for label, pat in retired_patterns.items():
    hits = [f.name for f in scan_files
            if re.search(pat, f.read_text(encoding="utf-8", errors="ignore"))]
    check(not hits, f"'{label}' absent from theme", f"found in {hits}")

print("\n9. No independent prices or durations in theme")
price_re = re.compile(r"€\s*\d+[.,]\d{2}")
dur_re = re.compile(r"\b(12|24|36)\s*(maanden|mnd)\b", re.I)
for f in scan_files:
    txt = f.read_text(encoding="utf-8", errors="ignore")
    if price_re.search(txt):
        found = sorted(set(price_re.findall(txt)))
        check(False, f"{f.name} contains a literal price", f"{found}")
    if dur_re.search(txt):
        check(False, f"{f.name} contains a literal duration",
              f"{sorted(set(m[0] for m in dur_re.findall(txt)))}")
else:
    if not any(price_re.search(f.read_text(encoding='utf-8', errors='ignore'))
               or dur_re.search(f.read_text(encoding='utf-8', errors='ignore'))
               for f in scan_files):
        check(True, "no theme file carries an independent price or duration")

print("\n10. Commercial pricing status (confirmed vs provisional)")
# Reflects the real commercial status rather than assuming every price is final.
# Veilig Onderweg / LioGo is the only line whose pricing decision is settled: it is
# locked as PRICE_PENDING (not purchasable) until an amount is commercially set.
# Every other line is a provisional working price that may change until confirmed.
KNOWN_STATUSES = {"CURRENT_WORKING", "PRICE_PENDING", "COMMERCIALLY_CONFIRMED"}
for p in gen["packages"]:
    st = p.get("pricingStatus")
    check(st in KNOWN_STATUSES, f"{p['name']} declares a known pricing status", f"status={st}")
    if p["lineId"] == "veilig-onderweg":
        check(st == "PRICE_PENDING" and not p["purchasable"],
              f"{p['name']} (Onderweg/LioGo) locked as PRICE_PENDING, not purchasable",
              f"status={st} purchasable={p['purchasable']}")
    label = {"CURRENT_WORKING": "PROVISIONAL", "PRICE_PENDING": "PENDING (locked)",
             "COMMERCIALLY_CONFIRMED": "CONFIRMED"}.get(st, st)
    print(f"        {p['lineName']}/{p['name']}: {label}")
# Add-ons: confirmed amounts live in config; provisional ones display 'Prijs volgt'.
check(cfg["labels"]["pricePending"] == "Prijs volgt",
      "central pending label is 'Prijs volgt' (used for all provisional add-ons)")

print("\n" + "=" * 60)
if failures:
    print(f"FAILED: {len(failures)} check(s)")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print(f"All checks passed. {len(priced)} purchasable packages verified.")
if warnings:
    for w in warnings:
        print(f"  note: {w}")
sys.exit(0)
