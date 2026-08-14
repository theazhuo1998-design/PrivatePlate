# Repository Instructions

## Product North Star guidance

Before any task involving product positioning, product strategy, roadmap direction, README framing, pitch materials, competition submissions, UX direction, or major feature decisions, read `PRODUCT_NORTH_STAR.md` first.

`PRODUCT_NORTH_STAR.md` is the canonical repository-level source for **product vision, positioning, and strategic interpretation**. It is not an implementation specification and must not override current code, accepted product requirements, engineering contracts, safety boundaries, or direct user instructions.

The current repository is an implementation slice of PrivatePlate, not the complete product definition.

### Required interpretation rules

- Do **not** infer the full product vision from the current codebase, README, demo surface, or competition scope.
- PrivatePlate is a **private household meal orchestration agent**. It coordinates family needs, pantry inventory, meal planning, shopping gaps, cooking support, and authorized task handoffs.
- PrivatePlate is not merely a meal recommendation tool, recipe chatbot, or a chat interface attached to an ordinary diet app.
- Smart-fridge screens, browser device simulators, voice interfaces, and future hardware are interfaces / deployment surfaces, not the product category by themselves.
- Competition-specific constraints, benchmark work, safety mechanisms, and engineering boundaries are important implementation evidence, but they must not replace the primary product story.
- Safety, privacy, deterministic logic, confirmation gates, and evaluation are enabling qualities. They are not the core user value proposition by themselves.
- Do not broaden the implementation merely to make it match the long-term vision. Preserve a clear distinction between product vision, current product scope, and what this repository actually implements today.
- When summarizing PrivatePlate, distinguish:
  1. the long-term PrivatePlate product direction,
  2. the current product scope,
  3. what this repository actually implements today.

### Source precedence

When sources disagree, use this order:

1. direct user instructions;
2. `PRODUCT_NORTH_STAR.md` for product vision, positioning, and strategic interpretation;
3. current accepted PRDs / implementation specs for delivery scope, architecture, contracts, and acceptance criteria;
4. the repository and README for what is actually implemented and publicly claimable today.

A product-vision document must not be used to invent unapproved engineering work, and a narrow implementation snapshot must not be used to shrink the product vision.

### Downstream agent handoffs

When creating a task packet, implementation brief, or handoff for Grok, Claude, another coding agent, or a new AI session, make the first instruction:

> Read `AGENTS.md` and `PRODUCT_NORTH_STAR.md` before interpreting the product or proposing product-level changes.

Do not rely on a paraphrased second-hand summary of the north star when the repository files are available.
