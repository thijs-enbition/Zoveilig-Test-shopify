#!/usr/bin/env python3
"""
Zo Veilig pricing builder (v3 intro-promo model).

Reads pricing.config.json (INPUTS only) and derives every money value once:

    promoDiscountTotal      = promo.months * half_up(monthly * promo.rate)   [per unit]
    promoWas                = promo.months * monthly                 (undiscounted worth)
    dueToday[option]        = install_option + promoDiscountTotal    (per install option)
    indicativeContractValue = activation + promoDiscountTotal + monthly * (term - promo.months)
    woning option N         = N * extra-etage per month from month 4 (NAMI packages only)
    woningContractValue[N]  = N * (promo.months * half_up(extra-etage * promo.rate)
                                   + extra-etage * (term - promo.months))   [added to the ICV]

promoDiscountTotal is what the package line costs today. It is rounded PER UNIT, then
multiplied by promo.months, because that is how Shopify applies the automatic discount:
each unit of the package line is priced on its own (e.g. 2495 x 50% = 1247.5 -> 1248 per
unit, x 3 = 3744), not the line as a whole (7485 x 50% = 3742.5 -> 3743). Measured in real
carts, 2026-09-23; see docs/prepay-qty3-2026-09-23.md.

What Shopify collects today is the chosen installation option (never discounted) plus
the real package product at quantity promo.months (3), which Shopify's automatic
"Eerste 3 maanden" discount takes promo.ratePercent (50%) off - so that line costs
promoDiscountTotal (2026-09-23 model, no separate promo products). The monthly rate is
never modified here and is billed by Odoo from month 4. The 1.5x 'eerste
vooruitbetaling' commitment is RETIRED (v2), and so is the 'discounted monthly
instalment' figure that v3 first modelled the promo as.

Emits:
    pricing.generated.json          machine-readable, for checks / JS / dataLayer
    ../snippets/zv-pricing.liquid   single source the theme renders from
    ../snippets/zv-item-names.liquid  product handle -> config name JSON, rendered once by
                                    the layout for JS (cart drawer, GA4 item_name)

Money is integer cents throughout. Rounding is ROUND_HALF_UP, never banker's.
Run:  python3 scripts/build_pricing.py
"""

from decimal import Decimal, ROUND_HALF_UP
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONFIG = ROOT / "pricing" / "pricing.config.json"
GENERATED = ROOT / "pricing" / "pricing.generated.json"
SNIPPET = ROOT / "snippets" / "zv-pricing.liquid"
ITEM_NAMES = ROOT / "snippets" / "zv-item-names.liquid"
PACKAGE_HANDLES = ROOT / "snippets" / "zv-package-handles.liquid"


def cents_half_up(value: Decimal) -> int:
    """Round a Decimal number of cents to a whole cent, half away from zero."""
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def eur(cents: int) -> str:
    """Format integer cents as a Dutch euro string: 3743 -> 'EUR 37,43'."""
    s = f"{cents // 100:,}".replace(",", ".")
    return f"€ {s},{cents % 100:02d}"


def is_priced(price: dict) -> bool:
    return isinstance(price, dict) and "amountCents" in price


def build():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))

    activation_cents = cfg["activation"]["amountCents"]
    default_term = cfg["contract"]["defaultTermMonths"]
    enabled_terms = [o["months"] for o in cfg["contract"]["options"] if o["enabled"]]

    promo = cfg["promo"]
    promo_enabled = bool(promo.get("enabled", True))
    promo_months = int(promo["months"])
    promo_rate = Decimal(str(promo["ratePercent"])) / Decimal(100)
    # True only when the promo is both switched on AND has a non-zero rate, so either
    # `enabled: false` or `ratePercent: 0` fully hides every promo-specific display
    # (badge, disclosure, discount rows) via zv_promo_active, without a second flag to keep in sync.
    promo_active = promo_enabled and promo_rate > 0

    # NAMI installation choice (Inzicht/Zeker/Alert only; Climax keeps the fixed `activation`
    # fee above, untouched). display is recomputed via eur(), same as activation's, rather
    # than trusting config's hand-typed string.
    nami_install_options = [
        {
            "id": o["id"],
            "label": o["label"],
            "amountCents": o["amountCents"],
            "display": eur(o["amountCents"]),
            "productHandle": o["productHandle"],
            "sku": o["sku"],
        }
        for o in cfg["installationOptions"]["nami"]["options"]
    ]

    # installation product handle -> the label the theme shows for it (NAMI options by their
    # own labels, the Climax installation by labels.activation), never the Shopify title.
    install_names = {o["productHandle"]: o["label"] for o in nami_install_options}
    if cfg["activation"].get("productHandle"):
        install_names[cfg["activation"]["productHandle"]] = cfg["labels"]["activation"]

    # The single source of truth for package DISPLAY ORDER: each package's custom.finder_key,
    # in the order `lines[].packages[]` lists them in pricing.config.json. Any theme surface
    # that renders package cards from a Shopify collection (Oplossingen, the pakket-matcher,
    # the homepage Keuzehulp preview) must render in this order and skip a product whose
    # finder_key isn't in it - never trust the collection's own manual sort. Odoo's product
    # sync appends a new/replacement product to the END of a collection (confirmed
    # 2026-09-23: it did this to Inzicht and Alert), which silently reorders any surface that
    # just loops `for p in collection.products` in collection order.
    package_order_fks = [
        pkg["finderKey"]
        for line in cfg["lines"]
        for pkg in line["packages"]
        if pkg.get("finderKey")
    ]

    # Packages BY HANDLE (2026-09-24, fix/packages-by-handle): the theme renders package
    # cards, the pakket-matcher's product map and the homepage finder's product map from
    # these lists, looking each product up with all_products[handle] in this order - never
    # from a tagged smart collection (the Odoo sync cleared the tags on N0001-N0003 on
    # 2026-09-24 and the packages vanished from the site). Each entry carries the SKU the
    # product's first variant must have; a missing product or a SKU mismatch skips that one
    # card. When Odoo replaces a product, update its productHandle (and sku) in the config.
    line_packages = [
        {
            "lineId": line["id"],
            "name": line.get("displayName") or line["id"],
            "packages": [
                {"finderKey": pkg.get("finderKey"), "handle": pkg.get("productHandle"), "sku": pkg.get("sku")}
                for pkg in line["packages"]
            ],
        }
        for line in cfg["lines"]
    ]

    # Woning surcharge (spec §7; Thijs 2026-09-24, NAMI only and a priced N0008 line since
    # 2026-09-25): NAMI packages only (surcharges[extra-etage].appliesTo: Inzicht, Zeker,
    # Alert). The choice stays the `Woning` line-item property on the package line, and the
    # cart also carries ONE line of the Shopify product surcharges[extra-etage].shopify (N0008)
    # at quantity promo.months x the floors over all NAMI package lines. That line is in the
    # "Eerste 3 maanden" discount, so each floor costs promo.months x half_up(unit x rate) today
    # (per unit, like the package line); Odoo bills unit per floor per month from month 4.
    # Option N (N extra floors or N x 100 m²) costs N x unit per month from month 4, and the
    # theme adds woningContractValue[N] = N x (promo.months x half_up(unit x rate) + unit x
    # (term - promo.months)) to a NAMI package's indicative contract value. Climax packages get
    # no woningContractValue at all. options[].value is the exact property value.
    etage = next(s for s in cfg["surcharges"] if s["id"] == "extra-etage")
    woning_cfg = etage["woning"]
    woning_unit_cents = etage["price"]["amountCents"]
    woning_shopify = etage.get("shopify") or {}
    woning_applies = list(etage.get("appliesTo") or [])
    # What one floor costs today on the N0008 line: promo.months units, each at the unit price
    # after the promo discount (rounded per unit, as Shopify does for the package line).
    woning_promo_unit_cents = cents_half_up(Decimal(woning_unit_cents) * promo_rate) if promo_enabled else woning_unit_cents
    woning_today_per_floor_cents = promo_months * woning_promo_unit_cents if promo_enabled else 0
    woning_applies_fks = [
        pkg.get("finderKey")
        for line in cfg["lines"]
        for pkg in line["packages"]
        if pkg.get("productHandle") in woning_applies
    ]
    woning_options = [
        {
            "floors": o["floors"],
            "value": o["value"],
            "monthlyCents": woning_unit_cents * o["floors"],
            "monthlyDisplay": eur(woning_unit_cents * o["floors"]),
        }
        for o in woning_cfg["options"]
    ]
    woning = {
        "surchargeId": etage["id"],
        "unitCents": woning_unit_cents,
        "unitDisplay": eur(woning_unit_cents),
        "heading": woning_cfg["heading"],
        "legacyValuePrefix": woning_cfg["legacyValuePrefix"],
        "options": woning_options,
        # The priced cart line (N0008), resolved by handle and checked by SKU in the theme.
        "shopify": {"handle": woning_shopify.get("handle"), "sku": woning_shopify.get("sku")},
        # NAMI package handles (and their finder_keys) that may carry Woning and count
        # towards the N0008 quantity. Nothing else ever does.
        "appliesTo": woning_applies,
        "appliesToFinderKeys": woning_applies_fks,
        # N0008 cart quantity per floor (one unit per prepaid month) and what that costs today.
        "cartQuantityPerFloor": promo_months if promo_enabled else 0,
        "todayCentsPerFloor": woning_today_per_floor_cents,
    }

    out = {
        "generatedFrom": "pricing.config.json",
        "configVersion": cfg["meta"]["version"],
        "currency": cfg["currency"],
        "rounding": cfg["rounding"],
        "activation": {"amountCents": activation_cents, "display": eur(activation_cents),
                       "label": cfg["labels"]["activation"],
                       "productHandle": cfg["activation"].get("productHandle"),
                       "sku": cfg["activation"].get("sku")},
        "installationOptions": {"nami": {"options": nami_install_options}},
        "promo": {
            "enabled": promo_enabled,
            "active": promo_active,
            "months": promo_months,
            "ratePercent": promo["ratePercent"],
            "label": promo["label"],
            "cardBadge": promo["cardBadge"],
            "timelineLabel": promo["timelineLabel"],
            "disclosure": promo["disclosure"],
            # The package line's cart quantity: one unit per prepaid month.
            "packageCartQuantity": promo_months,
        },
        "contract": {"defaultTermMonths": default_term, "enabledTerms": enabled_terms},
        "labels": cfg["labels"],
        # Display order for package cards (see package_order_fks above): the finder_key
        # values in pricing.config.json order. Theme surfaces must render in this order,
        # never a Shopify collection's own manual sort.
        "packageOrder": package_order_fks,
        # Per product line, in display order: finderKey, product handle and expected SKU
        # (see line_packages above). The theme's only source for which packages exist.
        "linePackages": line_packages,
        "packages": [],
        "addons": [],
        "woning": woning,
        "bundles": [],
        "tracking": cfg["tracking"],
        "unresolved": cfg["unresolved"],
    }

    for line in cfg["lines"]:
        for pkg in line["packages"]:
            price = pkg["monthlyRecurringPrice"]
            row = {
                "id": pkg["id"],
                "name": pkg["name"],
                # custom.finder_key of the Shopify product: how the theme maps a product or
                # cart line to this package, and so to its name (never the product title).
                "finderKey": pkg.get("finderKey"),
                "lineId": line["id"],
                "lineName": line["displayName"],
                "cat": line["cat"],
                "platform": pkg.get("platform"),
                "badge": pkg.get("badge"),
                "hook": pkg.get("hook"),
                "sub": pkg.get("sub"),
            }

            # Not purchasable: explicit flag (e.g. Vista = advies) or no amount yet.
            if pkg.get("purchasable") is False or not is_priced(price):
                row.update({
                    "purchasable": False,
                    "pricingStatus": "PRICE_PENDING",
                    "monthlyDisplay": price.get("display", cfg["labels"]["pricePending"]),
                    "cta": pkg.get("cta"),
                    "ctaLabel": pkg.get("ctaLabel"),
                })
                out["packages"].append(row)
                continue

            monthly = price["amountCents"]
            term = pkg.get("termMonths", default_term)

            # Per unit, then x months - Shopify's own rounding of the package line (see
            # module docstring). The ICV counts those prepaid months once, at what they
            # cost, plus the remaining months at the plain rate.
            promo_discount_total = promo_months * cents_half_up(Decimal(monthly) * promo_rate) if promo_enabled else 0
            icv = activation_cents + promo_discount_total + monthly * (term - (promo_months if promo_enabled else 0))

            # dueToday (kosten.xlsx + Thijs): installation is NEVER discounted; the
            # package line (qty promo.months, 50% off via Shopify's automatic discount)
            # is collected today alongside it. due_today = install_option_cents +
            # promo_discount_total, per available install option. NAMI packages offer
            # 3 install options (installationOptions.nami.options); Climax packages
            # keep the single fixed activation fee, emitted under the same 'huis' key
            # so callers can use one lookup pattern regardless of platform.
            install_group = pkg.get("installGroup")
            due_today = {}
            if install_group == "nami":
                for opt in nami_install_options:
                    due_today[opt["id"]] = {
                        "amountCents": opt["amountCents"] + promo_discount_total,
                        "display": eur(opt["amountCents"] + promo_discount_total),
                    }
            else:  # climax (or unset, treated as climax's single fixed fee)
                due_today["huis"] = {
                    "amountCents": activation_cents + promo_discount_total,
                    "display": eur(activation_cents + promo_discount_total),
                }
            # Scalar default/fallback: what's due today before any cheaper NAMI option
            # is chosen (matches the pre-existing default add-to-cart behaviour, which
            # always starts a package out with the flat activation-equivalent fee).
            due_today_default_cents = due_today["huis"]["amountCents"]

            # What the prepaid promo period is worth at the undiscounted monthly rate -
            # the "was" figure next to promoDiscountTotal on the actie page. It is a
            # 3-month total, never a monthly figure, so it must never be shown with /mnd.
            promo_was = monthly * promo_months if promo_enabled else 0

            # Woning (NAMI packages only): per floor, the N0008 line's prepaid months at what they
            # cost today (promo.months x half_up(unit x rate)) plus the unit for every month Odoo
            # bills, the same months the ICV bills the package at the plain rate. Climax packages
            # get no Woning contract value.
            recurring_months = term - (promo_months if promo_enabled else 0)
            woning_applies_pkg = pkg.get("productHandle") in woning_applies
            woning_contract_value = [
                {
                    "floors": o["floors"],
                    "cents": o["floors"] * (woning_today_per_floor_cents + woning_unit_cents * recurring_months),
                    "display": eur(o["floors"] * (woning_today_per_floor_cents + woning_unit_cents * recurring_months)),
                }
                for o in woning_options
            ] if woning_applies_pkg else []

            row.update({
                "purchasable": True,
                "pricingStatus": "CURRENT_WORKING",
                "termMonths": term,
                "installGroup": install_group,
                "productHandle": pkg.get("productHandle"),
                "sku": pkg.get("sku"),
                "monthlyRecurringPriceCents": monthly,
                "monthlyDisplay": eur(monthly),
                "promoMonths": promo_months if promo_enabled else 0,
                "promoWasCents": promo_was,
                "promoWasDisplay": eur(promo_was),
                "promoDiscountTotalCents": promo_discount_total,
                "promoDiscountTotalDisplay": eur(promo_discount_total),
                "activationPriceCents": activation_cents,
                "activationDisplay": eur(activation_cents),
                "dueToday": due_today,
                "initialPaymentDueTodayCents": due_today_default_cents,
                "initialPaymentDueTodayDisplay": eur(due_today_default_cents),
                "indicativeContractValue": {
                    "status": "CURRENT_WORKING",
                    "cents": icv,
                    "display": eur(icv),
                    "recurringMonthsBilled": recurring_months,
                    "label": cfg["labels"]["indicativeContractValue"],
                },
                "woningApplies": woning_applies_pkg,
                "woningContractValue": woning_contract_value,
            })
            out["packages"].append(row)

    for a in cfg["addons"] + cfg["surcharges"]:
        p = a["price"]
        out["addons"].append({
            "id": a["id"],
            "sku": a.get("sku"),
            "name": a["name"],
            "category": a.get("category"),
            "billing": a["billing"],
            "purchasable": a.get("purchasable", True),
            "priceCents": p.get("amountCents"),
            "display": p.get("display") if not is_priced(p) else eur(p["amountCents"]),
            "pricingStatus": "PRICE_PENDING" if not is_priced(p) else "CURRENT_WORKING",
        })

    for b in cfg["bundles"]:
        out["bundles"].append({
            "id": b["id"],
            "name": b["name"],
            "badge": b.get("badge"),
            "priceNowCents": b["priceNow"]["amountCents"],
            "priceNowDisplay": eur(b["priceNow"]["amountCents"]),
            "priceWasCents": (b["priceWas"] or {}).get("amountCents") if b.get("priceWas") else None,
            "priceWasDisplay": eur(b["priceWas"]["amountCents"]) if b.get("priceWas") else None,
            "priceWasVerified": b.get("priceWasVerified", False),
        })

    GENERATED.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Theme materialisation: JSON island for JS + per-package Liquid assigns.
    lines = [
        "{%- comment -%}",
        "  GENERATED FILE. Do not edit by hand.",
        "  Source: pricing/pricing.config.json",
        "  Rebuild: python3 scripts/build_pricing.py",
        "  Single source of truth for every customer-visible price and duration.",
        "{%- endcomment -%}",
        "",
        '<script type="application/json" id="zv-pricing-config">',
        json.dumps(out, ensure_ascii=False, separators=(",", ":")),
        "</script>",
        "",
        f"{{%- assign zv_promo_months = {out['promo']['months']} -%}}",
        f"{{%- assign zv_promo_package_qty = {out['promo']['packageCartQuantity']} -%}}",
        f"{{%- assign zv_promo_active = {str(promo_active).lower()} -%}}",
        f"{{%- assign zv_promo_badge = '{out['promo']['cardBadge']}' -%}}",
        f"{{%- assign zv_promo_timeline = '{out['promo']['timelineLabel']}' -%}}",
        f"{{%- assign zv_promo_disclosure = '{out['promo']['disclosure']}' -%}}",
        f"{{%- assign zv_activation_handle = '{out['activation'].get('productHandle') or ''}' -%}}",
        f"{{%- assign zv_activation_sku = '{out['activation'].get('sku') or ''}' -%}}",
        f"{{%- assign zv_activation_cents = {activation_cents} -%}}",
        f"{{%- assign zv_label_activation = '{cfg['labels']['activation']}' -%}}",
        f"{{%- assign zv_label_commitment = '{cfg['labels']['commitment']}' -%}}",
        f"{{%- assign zv_label_due_today = '{cfg['labels']['dueToday']}' -%}}",
        f"{{%- assign zv_label_monthly_after = '{cfg['labels']['monthlyAfter']}' -%}}",
        f"{{%- assign zv_label_breakdown_intro = '{cfg['labels']['breakdownIntro']}' -%}}",
        # finder_key -> package name, for snippets/zv-package-name.liquid. The theme shows
        # these names, never the Shopify product title (Odoo renames products).
        "{%- assign zv_package_names_by_fk = '" + "|".join(
            f"{p['finderKey']}:{p['name']}" for p in out["packages"] if p.get("finderKey")) + "' -%}",
        # installation product handle -> its config label, for snippets/zv-install-name.liquid.
        "{%- assign zv_install_names_by_handle = '" + "|".join(
            f"{h}:{n}" for h, n in install_names.items()) + "' -%}",
        # Package display order (finder_key values, pricing.config.json order). Every theme
        # surface that renders package cards from a collection reorders to match this and
        # skips any product whose finder_key isn't in it - see package_order_fks above.
        f"{{%- assign zv_package_order_fks = '{'|'.join(package_order_fks)}' -%}}",
    ]
    # Packages by handle (see line_packages): per line the ordered handles and the SKU each
    # product's first variant must have, plus the same over all lines for the homepage finder.
    for ln in line_packages:
        lid = ln["lineId"].replace("-", "_")
        lines += [
            f"{{%- assign zv_line_{lid}_handles = '{'|'.join(p['handle'] for p in ln['packages'])}' -%}}",
            f"{{%- assign zv_line_{lid}_skus = '{'|'.join(p['sku'] for p in ln['packages'])}' -%}}",
            f"{{%- assign zv_line_{lid}_name = '{ln['name']}' -%}}",
        ]
    lines += [
        f"{{%- assign zv_all_package_handles = '{'|'.join(p['handle'] for ln in line_packages for p in ln['packages'])}' -%}}",
        f"{{%- assign zv_all_package_skus = '{'|'.join(p['sku'] for ln in line_packages for p in ln['packages'])}' -%}}",
    ]
    for o in out["installationOptions"]["nami"]["options"]:
        oid = o["id"].replace("-", "_")
        lines += [
            f"{{%- assign zv_nami_install_{oid}_label = '{o['label']}' -%}}",
            f"{{%- assign zv_nami_install_{oid}_cents = {o['amountCents']} -%}}",
            f"{{%- assign zv_nami_install_{oid}_display = '{o['display']}' -%}}",
            f"{{%- assign zv_nami_install_{oid}_handle = '{o['productHandle']}' -%}}",
            f"{{%- assign zv_nami_install_{oid}_sku = '{o['sku']}' -%}}",
        ]
    # Woning surcharge: the unit, the heading, the legacy prefix, the N0008 product (handle and
    # the SKU its first variant must have), the NAMI package handles it applies to and, per
    # option, the exact property value and its monthly amount (zv_woning_<floors>_value / _cents).
    lines += [
        f"{{%- assign zv_woning_unit_cents = {woning['unitCents']} -%}}",
        f"{{%- assign zv_woning_heading = '{woning['heading']}' -%}}",
        f"{{%- assign zv_woning_legacy_prefix = '{woning['legacyValuePrefix']}' -%}}",
        f"{{%- assign zv_woning_handle = '{woning['shopify'].get('handle') or ''}' -%}}",
        f"{{%- assign zv_woning_sku = '{woning['shopify'].get('sku') or ''}' -%}}",
        f"{{%- assign zv_woning_applies_handles = '{'|'.join(woning['appliesTo'])}' -%}}",
    ]
    for o in woning["options"]:
        lines += [
            f"{{%- assign zv_woning_{o['floors']}_value = '{o['value']}' -%}}",
            f"{{%- assign zv_woning_{o['floors']}_cents = {o['monthlyCents']} -%}}",
        ]
    for p in out["packages"]:
        pid = p["id"].replace("-", "_")
        if not p.get("purchasable"):
            lines.append(f"{{%- assign zv_{pid}_name = '{p['name']}' -%}}")
            lines.append(f"{{%- assign zv_{pid}_monthly = '{p['monthlyDisplay']}' -%}}")
            if p.get("ctaLabel"):
                lines.append(f"{{%- assign zv_{pid}_cta = '{p['ctaLabel']}' -%}}")
            continue
        lines += [
            f"{{%- assign zv_{pid}_name = '{p['name']}' -%}}",
            f"{{%- assign zv_{pid}_monthly = '{p['monthlyDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_monthly_cents = {p['monthlyRecurringPriceCents']} -%}}",
            f"{{%- assign zv_{pid}_promo_discount = '{p['promoDiscountTotalDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_promo_discount_cents = {p['promoDiscountTotalCents']} -%}}",
            f"{{%- assign zv_{pid}_promo_was = '{p['promoWasDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_promo_was_cents = {p['promoWasCents']} -%}}",
            f"{{%- assign zv_{pid}_handle = '{p.get('productHandle') or ''}' -%}}",
            f"{{%- assign zv_{pid}_activation = '{p['activationDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_due_today = '{p['initialPaymentDueTodayDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_due_today_cents = {p['initialPaymentDueTodayCents']} -%}}",
            f"{{%- assign zv_{pid}_term = {p['termMonths']} -%}}",
            f"{{%- assign zv_{pid}_icv = '{p['indicativeContractValue']['display']}' -%}}",
            f"{{%- assign zv_{pid}_icv_cents = {p['indicativeContractValue']['cents']} -%}}",
        ]
        # What each Woning option adds to this package's ICV (Overzicht adds it to zv_<pid>_icv_cents).
        # NAMI packages only: Climax packages have an empty woningContractValue, so no assign.
        for wcv in p["woningContractValue"]:
            lines.append(f"{{%- assign zv_{pid}_woning_{wcv['floors']}_icv_cents = {wcv['cents']} -%}}")
        for opt_id, opt in p["dueToday"].items():
            oid = opt_id.replace("-", "_")
            lines += [
                f"{{%- assign zv_{pid}_due_today_{oid} = '{opt['display']}' -%}}",
                f"{{%- assign zv_{pid}_due_today_{oid}_cents = {opt['amountCents']} -%}}",
            ]
    SNIPPET.parent.mkdir(parents=True, exist_ok=True)
    SNIPPET.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Product handle -> the name the theme shows, for JS that only has Cart AJAX data (no
    # product metafields, so no finder_key): packages by their config productHandle, which the
    # config pairs with the finderKey; installation products by their configured handle.
    item_names = {p["productHandle"]: p["name"] for p in out["packages"] if p.get("productHandle")}
    item_names.update(install_names)
    ITEM_NAMES.write_text("\n".join([
        "{%- comment -%}",
        "  GENERATED FILE. Do not edit by hand.",
        "  Source: pricing/pricing.config.json",
        "  Rebuild: python3 scripts/build_pricing.py",
        "  Product handle -> the name the theme shows (never the Shopify product title), for JS",
        "  that only sees Cart AJAX data: the Oplossingen cart drawer and GA4 item_name",
        "  (assets/zv-track.js). Rendered once per page by layout/theme.liquid.",
        "{%- endcomment -%}",
        '<script type="application/json" id="zv-item-names">'
        + json.dumps(item_names, ensure_ascii=False, separators=(",", ":")) + "</script>",
    ]) + "\n", encoding="utf-8")

    # Packages by handle for render'ed snippets that can't see zv-pricing's variables (the
    # pakket-matcher, the homepage finder): echoes one line's ordered handles, skus or name.
    ph = [
        "{%- comment -%}",
        "  GENERATED FILE. Do not edit by hand.",
        "  Source: pricing/pricing.config.json (lines[].packages[].productHandle / sku)",
        "  Rebuild: python3 scripts/build_pricing.py",
        "  Usage: capture the output of: render 'zv-package-handles', line: 'langer-thuis', what: 'handles'",
        "  line: a pricing.config.json line id, or 'all'; what: 'handles' (default), 'skus' or 'name'.",
        "  Pipe-separated, in display order. Packages are looked up with all_products[handle],",
        "  never from a tagged collection (fix/packages-by-handle, 2026-09-24).",
        "{%- endcomment -%}",
        "{%- liquid",
        "  case line",
    ]
    def _ph_branch(key, handles, skus, name):
        return [
            f"    when '{key}'",
            "      if what == 'skus'",
            f"        echo '{skus}'",
            "      elsif what == 'name'",
            f"        echo '{name}'",
            "      else",
            f"        echo '{handles}'",
            "      endif",
        ]
    for ln in line_packages:
        ph += _ph_branch(ln["lineId"], "|".join(p["handle"] for p in ln["packages"]),
                         "|".join(p["sku"] for p in ln["packages"]), ln["name"])
    ph += _ph_branch("all", "|".join(p["handle"] for ln in line_packages for p in ln["packages"]),
                     "|".join(p["sku"] for ln in line_packages for p in ln["packages"]), "")
    ph += ["  endcase", "-%}"]
    PACKAGE_HANDLES.write_text("\n".join(ph) + "\n", encoding="utf-8")

    priced = [p for p in out["packages"] if p.get("purchasable")]
    print(f"wrote {GENERATED.name}, snippets/{SNIPPET.name} and snippets/{ITEM_NAMES.name}")
    print(f"  packages: {len(out['packages'])} ({len(priced)} purchasable)")
    print(f"  activation: {eur(activation_cents)} | promo: {promo_months}m @ {promo['ratePercent']}% | terms: {enabled_terms}")
    print("  nami install options: " + ", ".join(f"{o['label']} {o['display']}" for o in nami_install_options))
    print("  woning: " + ", ".join(f"{o['floors']}={o['monthlyDisplay']}/mnd" for o in woning_options)
          + f" (unit {woning['unitDisplay']}, {woning['surchargeId']}, {woning['shopify'].get('sku')}"
          + f" {woning['shopify'].get('handle')}, today {eur(woning_today_per_floor_cents)} per floor,"
          + f" applies to {', '.join(woning['appliesTo'])})")
    for p in priced:
        due_today_breakdown = ", ".join(f"{oid}={opt['display']}" for oid, opt in p["dueToday"].items())
        woning_icv = ", ".join(f"{w['floors']}=+{w['display']}" for w in p["woningContractValue"]) or "n/a"
        print(f"  - {p['lineName']}/{p['name']} ({p['installGroup']}): monthly {p['monthlyDisplay']}"
              f" | package x{out['promo']['packageCartQuantity']} today {p['promoDiscountTotalDisplay']} (was {p['promoWasDisplay']})"
              f" | due today [{due_today_breakdown}]"
              f" | {p['termMonths']}m | ICV {p['indicativeContractValue']['display']} | woning ICV [{woning_icv}]")


if __name__ == "__main__":
    build()
