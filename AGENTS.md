# Repository Instructions

## Product North Star is authoritative

Before any task involving product positioning, architecture interpretation, roadmap, README, pitch materials, competition submissions, UX direction, or major feature decisions, read `PRODUCT_NORTH_STAR.md` first.

The current repository is an implementation slice, not the complete product definition.

### Required interpretation rules

- Do **not** infer the full product vision from the current codebase, README, demo surface, or competition scope.
- PrivatePlate is the **meal and nutrition coordination vertical** of a broader Household Agent vision. It is not the final scope of the product idea.
- The broader thesis is reducing invisible domestic cognitive and coordination labor: remembering household state, planning, reconciling needs, making routine decisions, and handing work to people, devices, or future robots.
- Smart-fridge screens and browser device simulators are interfaces / deployment surfaces, not the product category.
- "Home Hub" is not a canonical product direction unless the user explicitly reintroduces it.
- Competition-specific constraints, benchmark work, safety mechanisms, and engineering boundaries are important implementation evidence, but they must not replace the primary product story.
- Safety, privacy, deterministic logic, confirmation gates, and evaluation are enabling qualities. They are not the core user value proposition by themselves.
- Do not broaden the implementation merely to make it match the long-term vision. Preserve a clear distinction between current implemented scope, near-term extensions, and long-term vision.
- When summarizing PrivatePlate, explicitly distinguish:
  1. the long-term Household Agent north star,
  2. PrivatePlate as the first meal/nutrition vertical,
  3. what this repository actually implements today.

If repository documents conflict on product interpretation, treat `PRODUCT_NORTH_STAR.md` as the canonical repository-level product source unless a direct user instruction overrides it.
