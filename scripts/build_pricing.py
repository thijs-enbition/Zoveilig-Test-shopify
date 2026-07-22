#!/usr/bin/env python3
"""
Zo Veilig pricing builder.

Reads pricing.config.json (inputs only) and derives every money value exactly once:

    initialCommitmentAmount = monthlyRecurringPrice * commitment.multiplier
    initialPaymentDueToday  = activationPrice + initialCommitmentAmount
    indicativeContractValue = activationPrice + initialCommitmentAmount + remaining recurring

Emits:
    pricing.generated.json          machine-readable, for checks / JS / dataLayer
    ../theme/snippets/zv-pricing.liquid   single source the theme renders from

Money is integer cents throughout. Rounding is ROUND_HALF_UP, never banker's rounding:
1.5 * 2495 = 3742.5 must become 3743 (EUR 37,43), not 3742.

Run:  python3 build_pricing.py
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
    multiplier = Decimal(str(cfg["commitment"]["multiplier"]))
    default_term = cfg["contract"]["defaultTermMonths"]
    enabled_terms = [o["months"] for o in cfg["contract"]["options"] if o["enabled"]]
    credit = cfg["commitment"]["creditTreatment"]

    out = {
        "generatedFrom": "pricing.config.json",
        "configVersion": cfg["meta"]["version"],
        "currency": cfg["currency"],
        "rounding": cfg["rounding"],
        "activation": {"amountCents": activation_cents, "display": eur(activation_cents),
                       "label": cfg["labels"]["activation"]},
        "commitment": {"multiplier": float(multiplier), "label": cfg["labels"]["commitment"]},
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

            if not is_priced(price):
                row.update({
                    "purchasable": False,
                    "pricingStatus": "PRICE_PENDING",
                    "monthlyDisplay": price.get("display", cfg["labels"]["pricePending"]),
                })
                out["packages"].append(row)
                continue

            monthly = price["amountCents"]
            commitment = cents_half_up(Decimal(monthly) * multiplier)
            due_today = activation_cents + commitment
            term = pkg.get("termMonths", default_term)

            # Indicative contract value, computed BOTH ways because the Odoo
            # treatment is unresolved. Neither is authoritative yet.
            # credited: the prepayment covers the first 1.5 months, so only the
            #           remaining months are invoiced. No period counted twice.
            # separate: the prepayment is additional, all term months are invoiced.
            remaining_credited = (Decimal(term) - multiplier) * Decimal(monthly)
            icv_credited = activation_cents + commitment + cents_half_up(remaining_credited)
            icv_separate = activation_cents + commitment + (monthly * term)

            row.update({
                "purchasable": True,
                "pricingStatus": "CURRENT_WORKING",
                "termMonths": term,
                "monthlyRecurringPriceCents": monthly,
                "monthlyDisplay": eur(monthly),
                "initialCommitmentAmountCents": commitment,
                "initialCommitmentDisplay": eur(commitment),
                "activationPriceCents": activation_cents,
                "activationDisplay": eur(activation_cents),
                "initialPaymentDueTodayCents": due_today,
                "initialPaymentDueTodayDisplay": eur(due_today),
                "indicativeContractValue": {
                    "status": "UNRESOLVED_PENDING_ODOO",
                    "selectedMethod": credit.get("selected"),
                    "methods": {
                        "credited": {
                            "cents": icv_credited,
                            "display": eur(icv_credited),
                            "recurringMonthsBilled": float(Decimal(term) - multiplier),
                        },
                        "separate": {
                            "cents": icv_separate,
                            "display": eur(icv_separate),
                            "recurringMonthsBilled": term,
                        },
                    },
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

    # Theme materialisation. Liquid cannot parse JSON at render time, so the
    # generated data is emitted as a JSON island for JS (configurator, cart,
    # dataLayer) plus per-package Liquid assigns for server-rendered display.
    lines = [
        "{%- comment -%}",
        "  GENERATED FILE. Do not edit by hand.",
        "  Source: website/pricing/pricing.config.json",
        "  Rebuild: python3 website/pricing/build_pricing.py",
        "  Single source of truth for every customer-visible price and duration.",
        "{%- endcomment -%}",
        "",
        '<script type="application/json" id="zv-pricing-config">',
        json.dumps(out, ensure_ascii=False, separators=(",", ":")),
        "</script>",
        "",
    ]
    for p in out["packages"]:
        pid = p["id"].replace("-", "_")
        if not p.get("purchasable"):
            lines.append(f"{{%- assign zv_{pid}_monthly = '{p['monthlyDisplay']}' -%}}")
            continue
        lines += [
            f"{{%- assign zv_{pid}_monthly = '{p['monthlyDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_activation = '{p['activationDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_commitment = '{p['initialCommitmentDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_due_today = '{p['initialPaymentDueTodayDisplay']}' -%}}",
            f"{{%- assign zv_{pid}_term = {p['termMonths']} -%}}",
        ]
    SNIPPET.parent.mkdir(parents=True, exist_ok=True)
    SNIPPET.write_text("\n".join(lines) + "\n", encoding="utf-8")

    priced = [p for p in out["packages"] if p.get("purchasable")]
    print(f"wrote {GENERATED.name} and theme/snippets/{SNIPPET.name}")
    print(f"  packages: {len(out['packages'])} ({len(priced)} purchasable)")
    print(f"  activation: {eur(activation_cents)} | multiplier: {multiplier} | default term: {default_term}m")
    for p in priced:
        print(f"  - {p['lineName']}/{p['name']}: monthly {p['monthlyDisplay']}"
              f" | commitment {p['initialCommitmentDisplay']}"
              f" | due today {p['initialPaymentDueTodayDisplay']}"
              f" | ICV credited {p['indicativeContractValue']['methods']['credited']['display']}"
              f" / separate {p['indicativeContractValue']['methods']['separate']['display']}")


if __name__ == "__main__":
    build()
