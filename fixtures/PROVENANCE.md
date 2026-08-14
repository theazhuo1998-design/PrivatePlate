# Fixture provenance review

The current fixture set is staged for review and is not licensed for public
redistribution yet.

| Path | Current description | Publication status |
| --- | --- | --- |
| `household/demo-household.json` | Fictional household and inventory | Pending owner confirmation |
| `foods/*.json` | Small demonstration food and conversion set | Pending independent-source review |
| `meal-templates/*.json` | Demonstration meal templates | Pending independent-source review |
| `knowledge/cards.json` | Project-authored demo knowledge cards | Pending owner confirmation |
| `knowledge/corpus/*.md` | Project-authored RAG corpus | Pending owner confirmation |
| `evals/*.json` | Synthetic Agent evaluation cases | Pending owner confirmation |

`MANIFEST.json` records file hashes and currently sets
`allowsPublicRedistribution` to `false`. A reviewer must either document an
independently authored source for every file or replace uncertain values with a
new synthetic set before changing that flag.
