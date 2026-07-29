# Diagram sources (Mermaid `.mmd`)

These are the single-source Mermaid diagrams embedded in
[`../zo-veilig-commerce-architecture.md`](../zo-veilig-commerce-architecture.md). Edit
them here and keep the reference document in sync.

| File | Diagram |
|---|---|
| `erd.mmd` | Entity Relationship Diagram (8 tables) |
| `customer-journey.mmd` | Customer journey **and** data flow (anonymous → handover → Odoo). In this architecture the journey *is* the data flow, so a separate `data-flow.mmd` is intentionally not duplicated. |
| `solution-architecture.mmd` | Platform / system architecture |
| `roadmap.mmd` | Phase 1–6 roadmap |

Render locally with `mermaid-cli` (`mmdc -i erd.mmd -o erd.svg`) or view inline on GitHub.
