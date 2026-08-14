# PrivatePlate

PrivatePlate is a conversation-first household meal coordination Agent designed
for smart-fridge screens and home hubs. A family member tells it who is eating,
what should be used first, and what should be avoided. The Agent considers
inventory, household preferences, dietary constraints, and the day's meal state
in the background, then returns the result people actually need: a meal plan,
preparation status, and a shopping or household task list.

The product goal is to reduce the mental load of managing family meals. Health
profiles and nutrition budgets are internal planning inputs, not a dashboard the
household must supervise all day.

## What the runnable prototype includes

- Multi-turn Chinese conversation for planning and revising a family meal.
- Household members, inventory, preferences, constraints, and a cross-meal day ledger.
- Deterministic nutrition calculation and safety guardrails behind the Agent.
- Confirmation before durable writes or household-task creation.
- A result workspace that appears after the user's meal intent is clear.
- Browser microphone and refrigerator-photo intake with editable drafts.
- SQLite persistence, session checkpoints, and a small local RAG corpus.
- Public scripted evaluations for tool choice, parameters, privacy, and lifecycle safety.

This repository is a browser-based device simulator. It does not claim direct
integration with refrigerator sensors, wake words, appliance control, grocery
ordering, or an external messaging service. Photo and voice results require user
review. Nutrition values are engineering estimates for demonstration and are not
medical advice.

The files under `fixtures/` are AI-assisted synthetic demo data created
specifically for PrivatePlate. They do not redistribute real household records,
clinical datasets, measured nutrition databases, or third-party food datasets.
See `fixtures/PROVENANCE.md` for the provenance boundary.

## Architecture

```text
Browser conversation UI
        │ HTTP + SSE
        ▼
Express server ── Agent runtime ── OpenAI-compatible model on loopback
        │              │
        │              └── typed tools + confirmation boundary
        ▼
Domain service ── SQLite / inventory / day ledger / demo nutrition rules
        │
        └── local RAG embedding endpoint on loopback (optional)
```

The browser receives a reduced display projection. Detailed health tags and
nutrition profiles remain server-side inputs. The shared screen receives only
names, roles, safe execution cues, inventory facts, and confirmed result data.

## Requirements

- Node.js 22.13 or newer
- npm
- An OpenAI-compatible chat model endpoint on `127.0.0.1:8000`
- Optional OpenAI-compatible embedding endpoint on `127.0.0.1:8001`

Model weights and production food databases are not included.

## Run locally

Install dependencies:

```bash
npm ci
```

Create your local configuration:

```bash
cp .env.example .env
```

Edit `.env`, then load it into the current terminal:

```bash
set -a; source .env; set +a
```

Start the API in one terminal:

```bash
npm run dev:server
```

Start the web app in another terminal after loading the same `.env`:

```bash
npm run dev:web
```

Open `http://127.0.0.1:5173`.

The application only accepts loopback model endpoints. A loopback URL may still
terminate in an SSH tunnel. Strict on-device privacy is true only when the chat
model, embedding model, server, and SQLite database all run on the household
device. A remote self-hosted model must be disclosed as remote processing.

## Verify

```bash
npm run check
```

The test suite uses `ScriptedProductProvider` as a deterministic test double.
Passing tests proves code paths and safety contracts; it does not prove the
quality of any particular real model.

## Public/private boundary

This clean repository contains the candidate public layer: browser and server
applications, Agent orchestration, domain contracts, generic nutrition
guardrails, AI-assisted synthetic demo fixtures, and evaluation scaffolding.

The advanced chronic-disease recommendation engine, tuned thresholds, complete
food database, food-source audit pipeline, private regression matrix, historical
competition evidence, internal working documents, and model weights are not
included. See [OPEN_SOURCE_SCOPE.md](OPEN_SOURCE_SCOPE.md).

## License status

This repository is currently staged privately while the owner selects the final
source-code and synthetic-data licenses. Fixture provenance is already documented.
No open-source or open-data license has been granted yet. Do not make the
repository public until `LICENSE` and `DATA_LICENSE.md` reflect the owner's final
licensing choices.
