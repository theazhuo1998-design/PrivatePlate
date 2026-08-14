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
- `fixtures`: synthetic demo household, foods, templates, and knowledge cards pending provenance approval.
- `scripts/rag` and `scripts/c1`: local RAG helpers and fixture checksum generation.

## Explicitly not included

- Advanced chronic-disease algorithms, tuned rules, or multi-condition strategies.
- The production food database, authority-source imports, aliases, review pipeline, or source PDFs/OCR.
- Private regression matrices and commercially sensitive parameter thresholds.
- Model weights, credentials, `.env`, SQLite files, logs, or real household data.
- Historical AMD competition scripts, evidence, benchmark output, videos, slides, or submissions.
- GOAI internal execution guides, fact-check notes, screenshots, pitch deck, or submission video.
- Original repository history and internal collaboration files.

## Publication gate

The repository must remain private until all of the following are true:

1. The owner approves a source-code license.
2. Every fixture has a provenance record showing it can be redistributed.
3. The owner approves a separate data license for the approved fixtures.
4. Secret, path, binary, and large-file scans pass.
5. `npm ci` and `npm run check` pass from this clean export.

Files that fail provenance review must be removed or rebuilt from independently
authored synthetic values before publication.
