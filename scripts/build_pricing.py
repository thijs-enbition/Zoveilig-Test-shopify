#!/usr/bin/env python3
"""
Zo Veilig pricing builder (v3 intro-promo model).

Reads pricing.config.json (INPUTS only) and derives every money value once:

    promoMonthly           = monthly * (1 - promo.rate)              [half-up]
    promoDiscountTotal      = promo.months * monthly * promo.rate    [half-up]
    initialPaymentDueToday  = activation            (activation ONLY)
    indicativeContractValue = activation + monthly*term - promoDiscountTotal

The 1.5x 'eerste vooruitbetaling' commitment is RETIRED (was v2). Today's payment is
the activation only; the intro promo (50% off the first 3 monthly SEPA instalments)
replaces the prepayment. Odoo applies the promo to the recurring invoices; the theme
only displays it.

Emits:
    pricing.generated.json          machine-readable, for checks / JS / dataLayer
    ../snippets/zv-pricing.liquid   single source the theme renders from

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
        },
        "contract": {"defaultTermMonths": default_term, "enabledTerms": enabled_terms},
        "labels": cfg["labels"],
        "packages": [],
        "addons": [],
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

            promo_monthly = cents_half_up(Decimal(monthly) * (Decimal(1) - promo_rate)) if promo_enabled else monthly
            promo_discount_total = cents_half_up(Decimal(promo_months) * Decimal(monthly) * promo_rate) if promo_enabled else 0
            icv = activation_cents + (monthly * term) - promo_discount_total

            # dueToday (2026-09-22 model, kosten.xlsx + Thijs): installation is NEVER
            # discounted; the promo is a separate, always-positive, one-time add-on
            # collected today alongside it. due_today = install_option_cents +
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

            promo_product_cfg = pkg.get("promoProduct") or {}

            row.update({
                "purchasable": True,
                "pricingStatus": "CURRENT_WORKING",
                "termMonths": term,
                "installGroup": install_group,
                "monthlyRecurringPriceCents": monthly,
                "monthlyDisplay": eur(monthly),
                "promoMonths": promo_months if promo_enabled else 0,
                "promoMonthlyCents": promo_monthly,
                "promoMonthlyDisplay": eur(promo_monthly),
                "promoDiscountTotalCents": promo_discount_total,
                "promoDiscountTotalDisplay": eur(promo_discount_total),
                "promoProduct": {
                    "productHandle": promo_product_cfg.get("productHandle"),
                    "sku": promo_product_cfg.get("sku"),
                },
                "activationPriceCents": activation_cents,
                "activationDisplay": eur(activation_cents),
                "dueToday": due_today,
                "initialPaymentDueTodayCents": due_today_default_cents,
                "initialPaymentDueTodayDisplay": eur(due_today_default_cents),
                "indicativeContractValue": {
                    "status": "CURRENT_WORKING",
                    "cents": icv,
                    "display": eur(icv),
                    "recurringMonthsBilled": term,
                    "label": cfg["labels"]["indicativeContractValue"],
                },
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
    for p in out["packages"]:
        pid = p["id"].replace("-", "_")
        if not p.get("purchasable"):
            lines.append(f"{{%- assign zv_{pid}_monthly = '{p['monthlyDisplay']}' -%}}")
            if p.get("ctaLabel"):
                lines.append(f"{{%- assign zv_{pid}_cta = '{p['ctaLabel']}' -%}}")
            continue
        lines += [
            f"{{%- assign zv_{pid}_monthly = '{p['monthlyDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_monthly_cents = {p['monthlyRecurringPriceCents']} -%}}",
            f"{{%- assign zv_{pid}_promo_monthly = '{p['promoMonthlyDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_promo_monthly_cents = {p['promoMonthlyCents']} -%}}",
            f"{{%- assign zv_{pid}_promo_discount = '{p['promoDiscountTotalDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_promo_handle = '{p['promoProduct'].get('productHandle') or ''}' -%}}",
            f"{{%- assign zv_{pid}_promo_sku = '{p['promoProduct'].get('sku') or ''}' -%}}",
            f"{{%- assign zv_{pid}_activation = '{p['activationDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_due_today = '{p['initialPaymentDueTodayDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_due_today_cents = {p['initialPaymentDueTodayCents']} -%}}",
            f"{{%- assign zv_{pid}_term = {p['termMonths']} -%}}",
            f"{{%- assign zv_{pid}_icv = '{p['indicativeContractValue']['display']}' -%}}",
            f"{{%- assign zv_{pid}_icv_cents = {p['indicativeContractValue']['cents']} -%}}",
        ]
        for opt_id, opt in p["dueToday"].items():
            oid = opt_id.replace("-", "_")
            lines += [
                f"{{%- assign zv_{pid}_due_today_{oid} = '{opt['display']}' -%}}",
                f"{{%- assign zv_{pid}_due_today_{oid}_cents = {opt['amountCents']} -%}}",
            ]
    SNIPPET.parent.mkdir(parents=True, exist_ok=True)
    SNIPPET.write_text("\n".join(lines) + "\n", encoding="utf-8")

    priced = [p for p in out["packages"] if p.get("purchasable")]
    print(f"wrote {GENERATED.name} and snippets/{SNIPPET.name}")
    print(f"  packages: {len(out['packages'])} ({len(priced)} purchasable)")
    print(f"  activation: {eur(activation_cents)} | promo: {promo_months}m @ {promo['ratePercent']}% | terms: {enabled_terms}")
    print("  nami install options: " + ", ".join(f"{o['label']} {o['display']}" for o in nami_install_options))
    for p in priced:
        due_today_breakdown = ", ".join(f"{oid}={opt['display']}" for oid, opt in p["dueToday"].items())
        print(f"  - {p['lineName']}/{p['name']} ({p['installGroup']}): monthly {p['monthlyDisplay']}"
              f" | promo add-on +{p['promoDiscountTotalDisplay']}"
              f" | due today [{due_today_breakdown}]"
              f" | {p['termMonths']}m | ICV {p['indicativeContractValue']['display']}")


if __name__ == "__main__":
    build()
