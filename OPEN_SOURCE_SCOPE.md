# Candidate open-source scope

This repository is a clean export, not a copy of the original development Git
history. It is intentionally limited to files that can support an independently
runnable PrivatePlate demonstration.

## Included in this candidate export

- `apps/web`: conversation-first browser interface and device simulator.
- `apps/server`: local HTTP/SSE service, media intake, session and runtime boundaries.
- `packages/agent-runtime`: Agent loop, tool routing, validation, and confirmation flow.
- `packages/contracts`: shared schemas and stable data contracts.
- `packages/domain`: household, inventory, day-ledger, generic planning and demo nutrition logic.
- `packages/evals`: public evaluation runner, schemas, and synthetic cases.
- `fixtures`: AI-assisted synthetic demo household, foods, templates, knowledge cards, and evaluation cases with documented provenance.
- `scripts/rag` and `scripts/c1`: local RAG helpers and fixture checksum generation.

## Explicitly not included

- Advanced chronic-disease algorithms, tuned rules, or multi-condition strategies.
- The production food database, authority-source imports, aliases, review pipeline, or source PDFs/OCR.
- Private regression matrices and commercially sensitive parameter thresholds.
- Model weights, credentials, `.env`, SQLite files, logs, or real household data.
- Historical AMD competition scripts, evidence, benchmark output, videos, slides, or submissions.
- GOAI internal execution guides, fact-check notes, screenshots, pitch deck, or submission video.
- Original repository history and internal collaboration files.

## Fixture provenance

The current fixture set was created specifically for the PrivatePlate prototype
with AI assistance under the project owner's direction. It does not redistribute
real household records, clinical datasets, measured nutrition databases, or
third-party food datasets. See `fixtures/PROVENANCE.md` and
`fixtures/MANIFEST.json`.

## Publication gate

The repository must remain private until all of the following are true:

1. The owner approves a source-code license.
2. The owner approves a data license for the synthetic fixtures.
3. Secret, path, binary, and large-file scans pass.
4. `npm ci` and `npm run check` pass from this clean export.

Fixture provenance is already documented; the remaining data-side decision is
the license under which those synthetic fixtures may be redistributed.
