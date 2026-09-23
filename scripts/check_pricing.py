#!/usr/bin/env python3
"""
Zo Veilig pricing checks (v3 intro-promo model). Exits non-zero on failure to gate CI.

Covers:
  1 monthly price consistency (single source of truth)
  2 activation price consistency
  3 today's payment (install choice) + intro promo maths, promoWas per package
  4 due today per install option (install + package x3 at 50%), all 11 combinations,
    plus the live Shopify SKUs/handles the theme resolves (2026-09-23)
  5 contract duration
  6 indicative contract value (activation + prepaid months + monthly * remaining months)
  7 add-on prices
  8 analytics purchase value
  9 no retired or superseded value appears in a theme file
 10 no theme file carries an independent price or duration
 11 commercial pricing status

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
# Repriced 2026-09-22 (Thijs, confirmed live): EUR 49,00 -> EUR 99,00, to align this fixed
# Climax/default installation fee with Nami's "Installatie aan huis" price.
check(activation == 9900, "activation is EUR 99,00", f"got {activation}")
check(len({p["activationPriceCents"] for p in priced}) == 1,
      "one activation value across all packages")
check(all(p["activationPriceCents"] == activation for p in priced),
      "every package uses the central activation value")

print("\n3. Today's payment (install choice) + intro promo")
cfg_promo_enabled = bool(cfg["promo"].get("enabled", True))
promo_active = bool(cfg["promo"].get("enabled")) and promo_rate > 0
for p in priced:
    m = p["monthlyRecurringPriceCents"]
    # Per unit, then x months: Shopify prices each unit of the package line on its own
    # (2495 x 50% -> 1248, x 3 = 3744), measured in real carts 2026-09-23.
    exp_promo_disc = promo_months * half_up(Decimal(m) * promo_rate) if cfg_promo_enabled else 0
    check(p["promoDiscountTotalCents"] == exp_promo_disc,
          f"{p['name']} prepaid amount = months x half_up(monthly x rate), per unit",
          f"got {p['promoDiscountTotalCents']} expected {exp_promo_disc}")
    # promoWas is the undiscounted worth of the prepaid period - the struck-through
    # figure on the actie page. A 3-month total, never a monthly rate.
    exp_promo_was = m * promo_months if cfg_promo_enabled else 0
    check(p["promoWasCents"] == exp_promo_was,
          f"{p['name']} promo was = monthly x months",
          f"got {p['promoWasCents']} expected {exp_promo_was}")
    if promo_active:
        check(p["promoDiscountTotalCents"] > 0,
              f"{p['name']} prepaid 3 months cost a positive amount today")
        check(p["promoWasCents"] > p["promoDiscountTotalCents"],
              f"{p['name']} promo was exceeds what's actually charged",
              f"was={p['promoWasCents']} charged={p['promoDiscountTotalCents']}")
check(half_up(Decimal("3742.5")) == 3743,
      "rounding is half-up, not banker's", "1.5 x 2495 must give 3743")
check(cfg["rounding"]["method"] == "ROUND_HALF_UP", "config declares ROUND_HALF_UP")
check(cfg["commitment"].get("retired") is True,
      "the 1.5x commitment is marked retired (superseded by promo)")
check(gen["promo"]["active"] == promo_active,
      "generated promo.active matches enabled AND rate > 0",
      f"got {gen['promo']['active']} expected {promo_active}")
if not promo_active:
    for p in priced:
        check(p["promoDiscountTotalCents"] == 0,
              f"{p['name']} promo discount is 0 while promo is inactive",
              f"got {p['promoDiscountTotalCents']}")

for p in priced:
    check("promoMonthlyCents" not in p,
          f"{p['name']} carries no retired promoMonthly figure",
          "the discounted-monthly-rate concept is retired; nothing may render it")
    check("promoProduct" not in p,
          f"{p['name']} carries no promoProduct fields",
          "the separate PROMO-* products are retired (2026-09-23); never create products")

# What the package line costs today, exactly as Shopify charges it (Thijs, 2026-09-23).
EXPECTED_PROMO_TOTAL_CENTS = {"inzicht": 2994, "zeker": 3744, "alert": 3744,
                              "beschermd": 5994, "protect": 5694}
for pkg_id, exp in EXPECTED_PROMO_TOTAL_CENTS.items():
    got = next((p["promoDiscountTotalCents"] for p in priced if p["id"] == pkg_id), None)
    check(got == exp, f"{pkg_id} promoDiscountTotalCents = {exp}", f"got {got}")

# The struck-through "was" figure on the actie page: 3 x the confirmed monthly rate
# (Alert 24,95 and Protect 37,95 confirmed by Thijs 2026-09-23).
EXPECTED_PROMO_WAS_CENTS = {"inzicht": 5985, "zeker": 7485, "alert": 7485,
                            "beschermd": 11985, "protect": 11385}
for pkg_id, exp in EXPECTED_PROMO_WAS_CENTS.items():
    got = next((p["promoWasCents"] for p in priced if p["id"] == pkg_id), None)
    check(got == exp, f"{pkg_id} promoWasCents = {exp}", f"got {got}")
check(gen["promo"]["packageCartQuantity"] == promo_months,
      "package goes in the cart at quantity promo.months",
      f"got {gen['promo'].get('packageCartQuantity')} expected {promo_months}")

print("\n4. Due today per install option (install + package x3 at 50%)")
# The 11 "Vandaag te betalen" combinations (Thijs, 2026-09-23): installation is NEVER
# discounted, at any tier; the package line (qty 3) gets Shopify's automatic 50%.
# due_today = install_option_cents + promoDiscountTotalCents, rounded per unit like
# Shopify - these equal what real carts are charged, to the cent.
EXPECTED_DUE_TODAY_CENTS = {
    "inzicht": {"geen": 2994, "telefonisch": 6494, "huis": 12894},
    "zeker": {"geen": 3744, "telefonisch": 7244, "huis": 13644},
    "alert": {"geen": 3744, "telefonisch": 7244, "huis": 13644},
    "beschermd": {"huis": 15894},
    "protect": {"huis": 15594},
}
check(sum(len(v) for v in EXPECTED_DUE_TODAY_CENTS.values()) == 11, "all 11 combinations are asserted")
by_id = {p["id"]: p for p in priced}
for pkg_id, expected_options in EXPECTED_DUE_TODAY_CENTS.items():
    p = by_id[pkg_id]
    due_today = p.get("dueToday", {})
    check(set(due_today.keys()) == set(expected_options.keys()),
          f"{p['name']} offers exactly the expected install options",
          f"got {sorted(due_today.keys())} expected {sorted(expected_options.keys())}")
    for opt_id, exp_cents in expected_options.items():
        got = due_today.get(opt_id, {}).get("amountCents")
        check(got == exp_cents,
              f"{p['name']} dueToday.{opt_id} = install + promo add-on",
              f"got {got} expected {exp_cents}")
    if p["installGroup"] == "nami":
        for opt_id, exp_cents in expected_options.items():
            install_cents = next(o["amountCents"] for o in gen["installationOptions"]["nami"]["options"] if o["id"] == opt_id)
            check(due_today[opt_id]["amountCents"] == install_cents + p["promoDiscountTotalCents"],
                  f"{p['name']} dueToday.{opt_id} = install_option.amountCents + promoDiscountTotalCents")
    else:
        check(due_today["huis"]["amountCents"] == activation + p["promoDiscountTotalCents"],
              f"{p['name']} dueToday.huis = activation + promoDiscountTotalCents")

# The only products sold on this site (verified live via Admin API, 2026-09-23). The
# theme resolves them by handle; SKUs are what Odoo and GA4 see. Never create products.
EXPECTED_PACKAGE_PRODUCTS = {
    "inzicht": ("langer-thuis-inzicht", "N0001"), "zeker": ("langer-thuis-zeker", "N0002"),
    "alert": ("mijn-thuis-alert", "N0003"), "beschermd": ("langer-thuis-beschermd", "LT-BES"),
    "protect": ("mijn-thuis-protect", None),  # MT-PRO in Shopify; no sku field in config (unchanged)
}
for pkg_id, (handle, sku) in EXPECTED_PACKAGE_PRODUCTS.items():
    p = by_id[pkg_id]
    check(p["productHandle"] == handle, f"{p['name']} product handle is {handle}", f"got {p['productHandle']}")
    check(p.get("sku") == sku, f"{p['name']} SKU is {sku}", f"got {p.get('sku')}")
EXPECTED_NAMI_INSTALL = {"geen": ("geen-installatie-nami", "N0006"),
                         "telefonisch": ("telefonische-ondersteuning-installatie-nami", "N0005"),
                         "huis": ("installatie-nami", "N0004")}
for o in gen["installationOptions"]["nami"]["options"]:
    check((o["productHandle"], o["sku"]) == EXPECTED_NAMI_INSTALL.get(o["id"]),
          f"nami install {o['id']} is {EXPECTED_NAMI_INSTALL.get(o['id'])}", f"got {(o['productHandle'], o['sku'])}")
check((gen["activation"]["productHandle"], gen["activation"]["sku"]) == ("climax-instalatie", "CL003"),
      "Climax installation is climax-instalatie / CL003",
      f"got {(gen['activation']['productHandle'], gen['activation']['sku'])}")

print("\n5. Contract duration")
check(cfg["contract"]["defaultTermMonths"] == 36, "default term is 36 months")
enabled = [o["months"] for o in cfg["contract"]["options"] if o["enabled"]]
check(set(enabled) == {12, 36}, "12 and 36 are commercially enabled", f"enabled={enabled}")
check(all(o["months"] in (12, 24, 36) for o in cfg["contract"]["options"]),
      "12, 24 and 36 are all supported by the model")
for p in priced:
    check(p["termMonths"] in enabled,
          f"{p['name']} term is commercially enabled", f"got {p['termMonths']}")

print("\n6. Indicative contract value")
for p in priced:
    m = p["monthlyRecurringPriceCents"]
    icv = p["indicativeContractValue"]
    exp_icv = activation + p["promoDiscountTotalCents"] + m * (p["termMonths"] - promo_months)
    check(icv["cents"] == exp_icv,
          f"{p['name']} ICV = activation + prepaid months + monthly x remaining months",
          f"got {icv['cents']} expected {exp_icv}")
    check(icv["recurringMonthsBilled"] == p["termMonths"] - promo_months,
          f"{p['name']} ICV bills term - prepaid months monthly",
          f"got {icv['recurringMonthsBilled']}")
    check(icv["cents"] > 0, f"{p['name']} ICV positive")
# Zeker 36099 confirmed by Thijs (9900 + 3744 + 9 x 2495); the rest by the same rule.
EXPECTED_ICV_CENTS = {"inzicht": 30849, "zeker": 36099, "alert": 36099,
                      "beschermd": 147729, "protect": 140829}
for pkg_id, exp in EXPECTED_ICV_CENTS.items():
    got = next((p["indicativeContractValue"]["cents"] for p in priced if p["id"] == pkg_id), None)
    check(got == exp, f"{pkg_id} ICV = {exp}", f"got {got}")

print("\n7. Add-on prices")
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

print("\n8. Analytics purchase value")
ta = cfg["tracking"]["momentA"]
check(ta["valueSource"] == "initialPaymentDueToday", "Moment A value is initialPaymentDueToday")
for p in priced:
    # initialPaymentDueTodayCents is the default/fallback figure (huis, i.e. before any
    # cheaper NAMI option is chosen) - matches dueToday.huis exactly, which always equals
    # activation + promo (NAMI's 'huis' option is priced identically to activation, 9900).
    check(p["initialPaymentDueTodayCents"] == activation + p["promoDiscountTotalCents"],
          f"{p['name']} Moment A default (huis) equals activation + promo add-on")
for param in ("monthlyRecurringPrice", "indicativeContractValue"):
    check(param in ta["extraParams"], f"Moment A sends {param} as a separate parameter")
check(cfg["tracking"]["momentB"]["valueSource"] == "indicativeContractValue",
      "Moment B value is indicativeContractValue")
check(cfg["tracking"]["momentB"]["status"] == "BLOCKED_PENDING_ODOO",
      "Moment B marked blocked until Odoo confirms")

print("\n9. Retired and superseded values absent from theme")
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
    # Retired 2026-09-23: the separate prepaid promo products (deleted from Shopify).
    "PROMO-* product SKU": r"PROMO-",
    "eerste-3-maanden-* product handle": r"eerste-3-maanden-",
    "zv_promo_live theme setting": r"zv_promo_live",
}
for label, pat in retired_patterns.items():
    hits = [f.name for f in scan_files
            if re.search(pat, f.read_text(encoding="utf-8", errors="ignore"))]
    check(not hits, f"'{label}' absent from theme", f"found in {hits}")

print("\n10. No independent prices or durations in theme")
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

print("\n11. Commercial pricing status (confirmed vs provisional)")
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
