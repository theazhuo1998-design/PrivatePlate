# Open-source scope

This repository is a clean export, not a copy of the original development Git
history. It is intentionally limited to files that support an independently
runnable PrivatePlate demonstration.

## Included in this repository

- `apps/web`: conversation-first browser interface and device simulator.
- `apps/server`: local HTTP/SSE service, media intake, session and runtime boundaries.
- `packages/agent-runtime`: Agent loop, tool routing, validation, and confirmation flow.
- `packages/contracts`: shared schemas and stable data contracts.
- `packages/domain`: household, inventory, day-ledger, generic planning and demo nutrition logic.
- `packages/evals`: public evaluation runner, schemas, and synthetic cases.
- `fixtures`: AI-assisted synthetic demo household, foods, templates, knowledge cards, and evaluation cases with documented provenance.
- `scripts/rag` and `scripts/c1`: local RAG helpers and fixture checksum generation.

## Not included

- Production food databases or authority-source ingestion pipelines.
- Real household or user data.
- Private regression and evaluation material used outside this public repository.
- Model weights, credentials, `.env`, SQLite files, logs, or deployment secrets.
- Commercial or hardware-vendor integrations that are not part of this runnable demo.
- Historical AMD competition scripts, evidence, benchmark output, videos, slides, or submissions.
- GOAI internal execution guides, fact-check notes, screenshots, pitch deck, or submission video.
- Original repository history and internal collaboration files.

This boundary describes what is currently published. It is not a promise that
every future PrivatePlate feature, dataset, integration, or internal evaluation
artifact will be released publicly.

## Fixture provenance and license

The current fixture set was created specifically for the PrivatePlate prototype
with AI assistance under the project owner's direction. It does not redistribute
real household records, clinical datasets, measured nutrition databases, or
third-party food datasets. See `fixtures/PROVENANCE.md` and
`fixtures/MANIFEST.json`.

The source code is licensed under Apache-2.0. The files under `fixtures/` are
dedicated under CC0-1.0 unless otherwise noted. See `LICENSE` and
`DATA_LICENSE.md`.

## Publication checks

Before changing the repository from private to public, verify that:

1. Secret, local-path, binary, and large-file scans pass.
2. `npm ci` and `npm run check` pass from this clean export.

Licensing and fixture provenance are complete; these checks are operational
safety checks rather than unresolved ownership questions.
