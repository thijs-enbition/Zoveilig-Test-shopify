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
 12 package display order
 13 Woning surcharge: unit, property values, monthly amounts, contract value (NAMI only),
    the N0008 product it is collected by, and no theme file naming that product itself

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
    "protect": ("mijn-thuis-protect", "MT-PRO"),  # sku added to the config 2026-09-24 (packages by handle)
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

print("\n12. Package display order (pricing.config.json, never collection order)")
# Odoo's product sync appends a new/replacement product to the END of a Shopify collection
# (confirmed 2026-09-23: Inzicht and Alert) - every theme surface that renders package cards
# must order by pricing.config.json's lines[].packages[] sequence and skip an unknown
# finder_key, never trust the collection's own manual sort.
expected_order = [pkg["finderKey"] for line in cfg["lines"] for pkg in line["packages"] if pkg.get("finderKey")]
check(gen.get("packageOrder") == expected_order,
      "generated packageOrder matches pricing.config.json lines[].packages[] order",
      f"got {gen.get('packageOrder')} expected {expected_order}")
check(expected_order.index("aware") < expected_order.index("aware_plus") < expected_order.index("care"),
      "Langer Thuis order is Inzicht, Zeker, Beschermd", f"order={expected_order}")
check(expected_order.index("secure") < expected_order.index("guard") < expected_order.index("secure_plus"),
      "Mijn Thuis order is Alert, Protect, Vista", f"order={expected_order}")
snippet_text = (PRICING.parent / "snippets" / "zv-pricing.liquid").read_text(encoding="utf-8")
m = re.search(r"zv_package_order_fks = '([^']*)'", snippet_text)
check(m is not None and m.group(1).split("|") == expected_order,
      "snippets/zv-pricing.liquid's zv_package_order_fks matches the generated order",
      f"got {m.group(1) if m else None}")

print("\n13. Woning surcharge (extra-etage: NAMI only, Woning property + one priced N0008 line)")
# Spec §7, decisions by Thijs 2026-09-24 and 2026-09-25 (docs/woning-surcharge-research-2026-09-23.md,
# docs/woning-n0008-line-2026-09-25.md). The unit is surcharges[extra-etage]. Option N = N extra
# floors (or N x 100 m²) = N x unit per month from month 4, billed by Odoo. The cart also carries
# one N0008 line at promo.months x floors, in the "Eerste 3 maanden" discount, so each floor costs
# promo.months x half_up(unit x rate) today. The ICV adds N x (that + unit x (termMonths -
# promo.months)), for the NAMI packages in appliesTo only; Climax packages never get Woning.
etage = next((s for s in cfg["surcharges"] if s["id"] == "extra-etage"), None)
check(etage is not None, "config has surcharges[extra-etage]")
unit = etage["price"]["amountCents"] if etage else None
check(unit == 400, "extra-etage unit is EUR 4,00 per month", f"got {unit}")
check(addons.get("extra-etage", {}).get("priceCents") == unit,
      "generated addons[extra-etage] carries the same unit", f"got {addons.get('extra-etage')}")
woning = gen.get("woning") or {}
check(woning.get("surchargeId") == "extra-etage" and woning.get("unitCents") == unit,
      "generated woning block uses the extra-etage unit",
      f"got {woning.get('surchargeId')} / {woning.get('unitCents')}")
# The exact Woning property values Odoo must recognise (D1): no price in the value.
EXPECTED_WONING_VALUES = {1: "1 extra verdieping of 100 m²", 2: "2 extra verdiepingen of 200 m²"}
EXPECTED_WONING_MONTHLY_CENTS = {1: 400, 2: 800}
woning_opts = {o["floors"]: o for o in woning.get("options", [])}
check(sorted(woning_opts) == [1, 2], "exactly two Woning options, 1 and 2 floors",
      f"got {sorted(woning_opts)}")
for floors, value in EXPECTED_WONING_VALUES.items():
    o = woning_opts.get(floors, {})
    check(o.get("value") == value, f"Woning option {floors} property value is '{value}'",
          f"got {o.get('value')!r}")
    check("€" not in (o.get("value") or ""), f"Woning option {floors} value carries no price")
    check(o.get("monthlyCents") == EXPECTED_WONING_MONTHLY_CENTS[floors] == floors * unit,
          f"Woning option {floors} = {floors} x unit = {EXPECTED_WONING_MONTHLY_CENTS[floors]} per month",
          f"got {o.get('monthlyCents')}")
check(woning.get("legacyValuePrefix") == "Groter dan 100 m²",
      "legacy Woning values (prefix 'Groter dan 100 m²') are recognised",
      f"got {woning.get('legacyValuePrefix')!r}")
# The N0008 product the surcharge is collected by (Thijs, 2026-09-25). Never created or edited
# from this repo; the theme resolves it by handle and checks its first variant's SKU.
woning_shopify = (etage or {}).get("shopify") or {}
check(woning_shopify.get("sku") == "N0008", "extra-etage is collected by SKU N0008",
      f"got {woning_shopify.get('sku')!r}")
check(bool(woning_shopify.get("handle")), "extra-etage has a Shopify product handle",
      f"got {woning_shopify.get('handle')!r}")
check(woning.get("shopify") == {"handle": woning_shopify.get("handle"), "sku": woning_shopify.get("sku")},
      "generated woning.shopify matches the config", f"got {woning.get('shopify')}")
# NAMI only (Thijs, 2026-09-25): appliesTo lists package handles, and none may be Climax.
pkg_by_handle = {pkg.get("productHandle"): pkg for line in cfg["lines"] for pkg in line["packages"]}
applies = list((etage or {}).get("appliesTo") or [])
EXPECTED_WONING_APPLIES = ["langer-thuis-inzicht", "langer-thuis-zeker", "mijn-thuis-alert"]
check(applies == EXPECTED_WONING_APPLIES, "Woning applies to Inzicht, Zeker and Alert only",
      f"got {applies}")
climax_in_applies = [h for h in applies if (pkg_by_handle.get(h) or {}).get("installGroup") != "nami"]
check(not climax_in_applies, "appliesTo contains no Climax (or unknown) package",
      f"got {climax_in_applies}")
check(woning.get("appliesTo") == applies, "generated woning.appliesTo matches the config",
      f"got {woning.get('appliesTo')}")
# What one floor costs today on the N0008 line: promo.months units at half_up(unit x rate) each.
exp_today_per_floor = promo_months * half_up(Decimal(unit or 0) * promo_rate) if cfg_promo_enabled else 0
check(woning.get("todayCentsPerFloor") == exp_today_per_floor == 600,
      "one Woning floor costs 3 x half_up(400 x 50%) = 600 today",
      f"got {woning.get('todayCentsPerFloor')} rule {exp_today_per_floor}")
check(woning.get("cartQuantityPerFloor") == promo_months,
      "the N0008 line holds promo.months units per floor", f"got {woning.get('cartQuantityPerFloor')}")
# Contract value per Woning option: N x (3 x half_up(unit x rate) + unit x (term - 3)) on the NAMI
# packages (EUR 42/84 at 12 months), nothing on Climax.
EXPECTED_WONING_ICV_CENTS = {"inzicht": {1: 4200, 2: 8400}, "zeker": {1: 4200, 2: 8400},
                             "alert": {1: 4200, 2: 8400}, "beschermd": {}, "protect": {}}
for p in priced:
    got = {w["floors"]: w["cents"] for w in p.get("woningContractValue", [])}
    exp = EXPECTED_WONING_ICV_CENTS.get(p["id"])
    check(exp is not None, f"{p['name']} has expected Woning contract values")
    is_applies = p.get("productHandle") in applies
    check(p.get("woningApplies") is is_applies, f"{p['name']} woningApplies is {is_applies}",
          f"got {p.get('woningApplies')}")
    if not is_applies:
        check(got == {} and exp == {}, f"{p['name']} (Climax) has no Woning contract value", f"got {got}")
        continue
    for floors in (1, 2):
        rule = floors * (exp_today_per_floor + unit * (p["termMonths"] - promo_months))
        check(exp is not None and got.get(floors) == exp.get(floors) == rule,
              f"{p['name']} ({p['termMonths']} mnd) Woning {floors} adds {(exp or {}).get(floors)} = "
              f"{floors} x ({promo_months} x half_up(unit x rate) + unit x (term - {promo_months})) to the ICV",
              f"got {got.get(floors)} rule {rule}")
# The Liquid assigns Overzicht, /cart and the cards read (snippets/zv-pricing.liquid).
def snippet_int(name):
    mm = re.search(r"\{%- assign " + re.escape(name) + r" = (\d+) -%\}", snippet_text)
    return int(mm.group(1)) if mm else None
def snippet_str(name):
    mm = re.search(r"\{%- assign " + re.escape(name) + r" = '([^']*)' -%\}", snippet_text)
    return mm.group(1) if mm else None
check(snippet_int("zv_woning_unit_cents") == unit, "zv_woning_unit_cents matches the unit",
      f"got {snippet_int('zv_woning_unit_cents')}")
check(snippet_str("zv_woning_legacy_prefix") == woning.get("legacyValuePrefix"),
      "zv_woning_legacy_prefix matches the generated prefix")
check(snippet_str("zv_woning_heading") == woning.get("heading") and bool(woning.get("heading")),
      "zv_woning_heading matches the generated heading")
for floors, value in EXPECTED_WONING_VALUES.items():
    check(snippet_str(f"zv_woning_{floors}_value") == value, f"zv_woning_{floors}_value is '{value}'",
          f"got {snippet_str(f'zv_woning_{floors}_value')!r}")
    check(snippet_int(f"zv_woning_{floors}_cents") == EXPECTED_WONING_MONTHLY_CENTS[floors],
          f"zv_woning_{floors}_cents = {EXPECTED_WONING_MONTHLY_CENTS[floors]}",
          f"got {snippet_int(f'zv_woning_{floors}_cents')}")
for p in priced:
    pid = p["id"].replace("-", "_")
    for floors in (1, 2):
        exp = EXPECTED_WONING_ICV_CENTS.get(p["id"], {}).get(floors)
        name = f"zv_{pid}_woning_{floors}_icv_cents"
        check(snippet_int(name) == exp, f"{name} = {exp}" if exp is not None else f"{name} is not emitted (Climax)",
              f"got {snippet_int(name)}")
check(snippet_str("zv_woning_handle") == woning_shopify.get("handle"), "zv_woning_handle matches the config",
      f"got {snippet_str('zv_woning_handle')!r}")
check(snippet_str("zv_woning_sku") == woning_shopify.get("sku"), "zv_woning_sku matches the config",
      f"got {snippet_str('zv_woning_sku')!r}")
check(snippet_str("zv_woning_applies_handles") == "|".join(applies), "zv_woning_applies_handles matches appliesTo",
      f"got {snippet_str('zv_woning_applies_handles')!r}")
# The theme reads the N0008 product only through zv_woning_handle / zv_woning_sku: no theme file
# outside the generated ones may name its SKU or handle itself.
GENERATED_THEME_FILES = {"zv-pricing.liquid", "zv-item-names.liquid", "zv-package-handles.liquid"}
for label, needle in (("SKU", woning_shopify.get("sku")), ("handle", woning_shopify.get("handle"))):
    hits = [str(f.relative_to(ROOT)) for d in THEME_DIRS for f in (ROOT / d).rglob("*")
            if needle and f.is_file() and f.suffix in {".liquid", ".json", ".css", ".js"}
            and f.name not in GENERATED_THEME_FILES
            and needle in f.read_text(encoding="utf-8", errors="ignore")]
    check(not hits, f"no theme file hardcodes the Woning product {label} ({needle})", f"found in {hits}")

print("\n14. Packages by handle (pricing.config.json, never a tagged collection)")
# The theme renders package cards, the pakket-matcher's product map and the homepage finder's
# product map by looping these handles with all_products[handle] (fix/packages-by-handle,
# 2026-09-24), so every package needs a product handle and the SKU its first variant carries.
all_pkgs = [(line["id"], pkg) for line in cfg["lines"] for pkg in line["packages"]]
for line_id, pkg in all_pkgs:
    check(bool(pkg.get("productHandle")), f"{line_id}/{pkg['id']} has a productHandle", f"got {pkg.get('productHandle')!r}")
    check(bool(pkg.get("sku")), f"{line_id}/{pkg['id']} has a sku", f"got {pkg.get('sku')!r}")
handles = [pkg.get("productHandle") for _, pkg in all_pkgs]
skus = [pkg.get("sku") for _, pkg in all_pkgs]
check(len(set(handles)) == len(handles), "package handles are unique", f"got {handles}")
check(len(set(skus)) == len(skus), "package skus are unique", f"got {skus}")
gen_lines = gen.get("linePackages") or []
check([l["lineId"] for l in gen_lines] == [l["id"] for l in cfg["lines"]],
      "generated linePackages follows pricing.config.json lines[] order")
for line in cfg["lines"]:
    gl = next((l for l in gen_lines if l["lineId"] == line["id"]), None)
    exp = [(p.get("finderKey"), p.get("productHandle"), p.get("sku")) for p in line["packages"]]
    got = [(p.get("finderKey"), p.get("handle"), p.get("sku")) for p in (gl or {}).get("packages", [])]
    check(got == exp, f"generated linePackages[{line['id']}] matches the config order, handles and skus", f"got {got}")
    lid = line["id"].replace("-", "_")
    check(snippet_str(f"zv_line_{lid}_handles") == "|".join(p.get("productHandle") or "" for p in line["packages"]),
          f"zv_line_{lid}_handles matches the config", f"got {snippet_str(f'zv_line_{lid}_handles')!r}")
    check(snippet_str(f"zv_line_{lid}_skus") == "|".join(p.get("sku") or "" for p in line["packages"]),
          f"zv_line_{lid}_skus matches the config", f"got {snippet_str(f'zv_line_{lid}_skus')!r}")
check(snippet_str("zv_all_package_handles") == "|".join(handles), "zv_all_package_handles lists every package in config order")
check(snippet_str("zv_all_package_skus") == "|".join(skus), "zv_all_package_skus lists every package sku in config order")

ph_text = (PRICING.parent / "snippets" / "zv-package-handles.liquid").read_text(encoding="utf-8")
for line in cfg["lines"]:
    hs = "|".join(p.get("productHandle") or "" for p in line["packages"])
    ss = "|".join(p.get("sku") or "" for p in line["packages"])
    blk = ph_text.split(f"when '{line['id']}'", 1)[1].split("when '", 1)[0] if f"when '{line['id']}'" in ph_text else ""
    check(f"echo '{hs}'" in blk and f"echo '{ss}'" in blk, f"zv-package-handles.liquid has {line['id']} handles and skus from the config")
check(f"echo '{'|'.join(handles)}'" in ph_text and f"echo '{'|'.join(skus)}'" in ph_text, "zv-package-handles.liquid 'all' lists every package in config order")

print("\n" + "=" * 60)
if failures:
    print(f"FAILED: {len(failures)} check(s)")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print(f"All checks passed. {len(priced)} purchasable packages verified.")
sys.exit(0)
