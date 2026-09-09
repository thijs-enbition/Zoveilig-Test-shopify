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

    out = {
        "generatedFrom": "pricing.config.json",
        "configVersion": cfg["meta"]["version"],
        "currency": cfg["currency"],
        "rounding": cfg["rounding"],
        "activation": {"amountCents": activation_cents, "display": eur(activation_cents),
                       "label": cfg["labels"]["activation"],
                       "productHandle": cfg["activation"].get("productHandle"),
                       "sku": cfg["activation"].get("sku")},
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
            due_today = activation_cents  # activation ONLY; commitment retired
            icv = activation_cents + (monthly * term) - promo_discount_total

            row.update({
                "purchasable": True,
                "pricingStatus": "CURRENT_WORKING",
                "termMonths": term,
                "monthlyRecurringPriceCents": monthly,
                "monthlyDisplay": eur(monthly),
                "promoMonths": promo_months if promo_enabled else 0,
                "promoMonthlyCents": promo_monthly,
                "promoMonthlyDisplay": eur(promo_monthly),
                "promoDiscountTotalCents": promo_discount_total,
                "promoDiscountTotalDisplay": eur(promo_discount_total),
                "activationPriceCents": activation_cents,
                "activationDisplay": eur(activation_cents),
                "initialPaymentDueTodayCents": due_today,
                "initialPaymentDueTodayDisplay": eur(due_today),
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
            f"{{%- assign zv_{pid}_promo_monthly = '{p['promoMonthlyDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_promo_discount = '{p['promoDiscountTotalDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_activation = '{p['activationDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_due_today = '{p['initialPaymentDueTodayDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_term = {p['termMonths']} -%}}",
            f"{{%- assign zv_{pid}_icv = '{p['indicativeContractValue']['display']}' -%}}",
        ]
    SNIPPET.parent.mkdir(parents=True, exist_ok=True)
    SNIPPET.write_text("\n".join(lines) + "\n", encoding="utf-8")

    priced = [p for p in out["packages"] if p.get("purchasable")]
    print(f"wrote {GENERATED.name} and snippets/{SNIPPET.name}")
    print(f"  packages: {len(out['packages'])} ({len(priced)} purchasable)")
    print(f"  activation: {eur(activation_cents)} | promo: {promo_months}m @ {promo['ratePercent']}% | terms: {enabled_terms}")
    for p in priced:
        print(f"  - {p['lineName']}/{p['name']}: monthly {p['monthlyDisplay']}"
              f" | promo {p['promoMonthlyDisplay']} (-{p['promoDiscountTotalDisplay']})"
              f" | due today {p['initialPaymentDueTodayDisplay']}"
              f" | {p['termMonths']}m | ICV {p['indicativeContractValue']['display']}")


if __name__ == "__main__":
    build()
