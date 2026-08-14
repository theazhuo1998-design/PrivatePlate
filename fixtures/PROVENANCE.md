# Fixture provenance

The files under `fixtures/` are AI-assisted synthetic demonstration data created
specifically for the PrivatePlate prototype under the project owner's direction.
They do not redistribute real household records, clinical datasets, measured
nutrition databases, or third-party food datasets.

Nutrition and quantity values in these fixtures are engineering estimates for
demonstration only. They must not be presented as measured nutrition facts,
medical advice, or production data.

| Path | Provenance | Status |
| --- | --- | --- |
| `household/demo-household.json` | Fictional household and inventory, AI-assisted synthetic generation | Confirmed |
| `foods/*.json` | AI-assisted synthetic demo foods and unit-conversion values | Confirmed |
| `meal-templates/*.json` | AI-assisted synthetic demonstration meal templates | Confirmed |
| `knowledge/cards.json` | PrivatePlate project-authored, AI-assisted demo knowledge cards | Confirmed |
| `knowledge/corpus/*.md` | PrivatePlate project-authored demo RAG corpus, AI-assisted where applicable | Confirmed |
| `evals/*.json` | AI-assisted synthetic Agent evaluation cases | Confirmed |

This provenance was confirmed by the project owner on 2026-08-14.

`MANIFEST.json` records fixture hashes and the current redistribution status.
Provenance is confirmed, but public redistribution remains disabled until the
owner selects and approves a final data license.
