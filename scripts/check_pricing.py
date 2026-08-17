#!/usr/bin/env python3
"""
Zo Veilig pricing checks (v3 intro-promo model). Exits non-zero on failure to gate CI.

Covers:
  1 monthly price consistency (single source of truth)
  2 activation price consistency
  3 today's payment (activation only) + intro promo maths
  4 contract duration
  5 indicative contract value (activation + monthly*term - promo)
  6 add-on prices
  7 analytics purchase value
  8 no retired or superseded value appears in a theme file
  9 no theme file carries an independent price or duration
 10 commercial pricing status

Run:  python3 scripts/check_pricing.py
"""

from decimal import Decimal, ROUND_HALF_UP
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PRICING = ROOT / "pricing"
THEME_DIRS = ["assets", "config", "layout", "locales", "sections", "snippets", "templates"]
cfg = json.loads((PRICING / "pricing.config.json").read_text(encoding="utf-8"))
gen = json.loads((PRICING / "pricing.generated.json").read_text(encoding="utf-8"))

failures: list[str] = []


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
promo_months = int(cfg["promo"]["months"])
promo_rate = Decimal(str(cfg["promo"]["ratePercent"])) / Decimal(100)

print("\n1. Monthly price consistency (single source of truth)")
for p in priced:
    check(p["monthlyRecurringPriceCents"] == cfg_monthly[p["id"]],
          f"{p['name']} monthly matches central config",
          f"generated={p['monthlyRecurringPriceCents']} config={cfg_monthly[p['id']]}")
for p in priced:
    check(p["monthlyRecurringPriceCents"] > 0,
          f"{p['name']} carries a positive provisional price",
          f"status={p.get('pricingStatus')} cents={p['monthlyRecurringPriceCents']}")

print("\n2. Activation price consistency")
check(activation == 4900, "activation is EUR 49,00", f"got {activation}")
check(len({p["activationPriceCents"] for p in priced}) == 1,
      "one activation value across all packages")
check(all(p["activationPriceCents"] == activation for p in priced),
      "every package uses the central activation value")

print("\n3. Today's payment (activation only) + intro promo")
for p in priced:
    m = p["monthlyRecurringPriceCents"]
    exp_promo_monthly = half_up(Decimal(m) * (Decimal(1) - promo_rate))
    exp_promo_disc = half_up(Decimal(promo_months) * Decimal(m) * promo_rate)
    check(p["initialPaymentDueTodayCents"] == activation,
          f"{p['name']} due today = activation only",
          f"got {p['initialPaymentDueTodayCents']} expected {activation}")
    check(p["promoMonthlyCents"] == exp_promo_monthly,
          f"{p['name']} promo monthly = monthly x (1 - rate) (half-up)",
          f"got {p['promoMonthlyCents']} expected {exp_promo_monthly}")
    check(p["promoDiscountTotalCents"] == exp_promo_disc,
          f"{p['name']} promo discount = months x monthly x rate (half-up)",
          f"got {p['promoDiscountTotalCents']} expected {exp_promo_disc}")
check(half_up(Decimal("3742.5")) == 3743,
      "rounding is half-up, not banker's", "1.5 x 2495 must give 3743")
check(cfg["rounding"]["method"] == "ROUND_HALF_UP", "config declares ROUND_HALF_UP")
check(cfg["commitment"].get("retired") is True,
      "the 1.5x commitment is marked retired (superseded by promo)")

print("\n4. Contract duration")
check(cfg["contract"]["defaultTermMonths"] == 36, "default term is 36 months")
enabled = [o["months"] for o in cfg["contract"]["options"] if o["enabled"]]
check(set(enabled) == {12, 36}, "12 and 36 are commercially enabled", f"enabled={enabled}")
check(all(o["months"] in (12, 24, 36) for o in cfg["contract"]["options"]),
      "12, 24 and 36 are all supported by the model")
for p in priced:
    check(p["termMonths"] in enabled,
          f"{p['name']} term is commercially enabled", f"got {p['termMonths']}")

print("\n5. Indicative contract value")
for p in priced:
    m = p["monthlyRecurringPriceCents"]
    icv = p["indicativeContractValue"]
    exp_icv = activation + m * p["termMonths"] - p["promoDiscountTotalCents"]
    check(icv["cents"] == exp_icv,
          f"{p['name']} ICV = activation + monthly*term - promo",
          f"got {icv['cents']} expected {exp_icv}")
    check(icv["cents"] > 0, f"{p['name']} ICV positive")

print("\n6. Add-on prices")
addons = {a["id"]: a for a in gen["addons"]}
check(addons["alarmcom-domotica"]["priceCents"] == 400,
      "Domotica is EUR 4,00", f"got {addons['alarmcom-domotica']['priceCents']}")
onz = addons["ontzorgpakket"]
check(onz["purchasable"] is False, "Ontzorgpakket is not purchasable")
check(onz["priceCents"] is None, "Ontzorgpakket carries no amount", f"got {onz['priceCents']}")
check(onz["display"] == cfg["labels"]["pricePending"], "Ontzorgpakket shows 'Prijs volgt'")
bundles = {b["id"]: b for b in gen["bundles"]}
check(bundles["camera-deurbel"]["priceWasCents"] == 1990
      and bundles["camera-deurbel"]["priceWasVerified"],
      "Camera + Deurbel keeps its verified was-price")
for bid in ("volledig-gerust", "zorg-opvolging"):
    check(bundles[bid]["priceWasCents"] is None, f"{bid} has no unverified was-price")

print("\n7. Analytics purchase value")
ta = cfg["tracking"]["momentA"]
check(ta["valueSource"] == "initialPaymentDueToday", "Moment A value is initialPaymentDueToday")
for p in priced:
    check(p["initialPaymentDueTodayCents"] == activation,
          f"{p['name']} Moment A equals what Shopify collects (activation)")
for param in ("monthlyRecurringPrice", "indicativeContractValue"):
    check(param in ta["extraParams"], f"Moment A sends {param} as a separate parameter")
check(cfg["tracking"]["momentB"]["valueSource"] == "indicativeContractValue",
      "Moment B value is indicativeContractValue")
check(cfg["tracking"]["momentB"]["status"] == "BLOCKED_PENDING_ODOO",
      "Moment B marked blocked until Odoo confirms")

print("\n8. Retired and superseded values absent from theme")
scan_files = [p for d in THEME_DIRS for p in (ROOT / d).rglob("*")
              if p.is_file() and p.suffix in {".liquid", ".json", ".css", ".js"}
              and "zv-pricing.liquid" not in p.name]
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
# Guards the pricing SURFACES (cards, cart, checkout, configurator) against
# hardcoded money/terms that should come from zv-pricing.liquid. Purely editorial
# content templates legitimately mention durations in prose (contract pause periods,
# legal terms), so the DURATION scan skips them; the PRICE scan still covers everything.
CONTENT_TEMPLATES = {
    "page.klantenservice.json", "page.legal.json", "page.veelgestelde-vragen.json",
    "page.over-ons.json", "page.hoe-het-werkt.json",
}
price_re = re.compile(r"€\s*\d+[.,]\d{2}")
dur_re = re.compile(r"\b(12|24|36)\s*(maanden|mnd)\b", re.I)
independent = False
for f in scan_files:
    txt = f.read_text(encoding="utf-8", errors="ignore")
    if price_re.search(txt):
        independent = True
        check(False, f"{f.name} contains a literal price", f"{sorted(set(price_re.findall(txt)))}")
    if f.name not in CONTENT_TEMPLATES and dur_re.search(txt):
        independent = True
        check(False, f"{f.name} contains a literal duration",
              f"{sorted(set(m[0] for m in dur_re.findall(txt)))}")
if not independent:
    check(True, "no pricing surface carries an independent price or duration")

print("\n10. Commercial pricing status (confirmed vs provisional)")
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
check(cfg["labels"]["pricePending"] == "Prijs volgt",
      "central pending label is 'Prijs volgt'")

print("\n" + "=" * 60)
if failures:
    print(f"FAILED: {len(failures)} check(s)")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print(f"All checks passed. {len(priced)} purchasable packages verified.")
sys.exit(0)
