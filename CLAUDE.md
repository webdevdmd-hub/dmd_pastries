# Pastries POS

Multi-tenant bakery POS and double-entry accounting ERP. Go backend, Next.js + Tailwind + shadcn frontend, Appwrite auth, currency `en-AE` / AED.

## Design System

Always read [DESIGN.md](DESIGN.md) before making any visual or UI decision.
All font choices, colors, spacing, density, and aesthetic direction are defined there.
Do not deviate without explicit user approval.

- The system is **v3, proposed and mostly not yet applied**. Check [docs/design/UI-REBUILD-PLAN.md](docs/design/UI-REBUILD-PLAN.md) for which items have actually shipped before assuming a token exists in app code.
- Preview: [docs/design/preview-v3.html](docs/design/preview-v3.html). `docs/design/preview.html` is the superseded v2 preview.
- In QA and review, flag any code that does not match DESIGN.md.

**Document precedence.** Three documents describe this work and they have already contradicted each other. On conflict:

1. [DESIGN.md](DESIGN.md) — what it should look like. Wins on tokens, type, colour, and component rules.
2. [docs/design/UI-REBUILD-PLAN.md](docs/design/UI-REBUILD-PLAN.md) — what we are doing and in what order. **Wins on sequencing and scope.**
3. [docs/design/MIGRATION.md](docs/design/MIGRATION.md) — the mechanical how-to. Subordinate to the plan on ordering.

Deferred work lives in [TODOS.md](TODOS.md), not in prose inside these three.

Non-negotiables while the migration is in flight:

- No hardcoded hex in `className`. Canvas and WebGL colors import from `@/lib/design/palette`.
- No raw Tailwind palette colors (`text-zinc-600`, `bg-red-50`, …). Use tokens.
- No font weight above 600. 500 is the workhorse.
- No uppercase with wide tracking in-app. One mono eyebrow per threshold screen is the only exception.
- Nothing below 12px.
- `tabular-nums` on every money, count, date, and percentage cell.
- Counter register (`/pos`) tap targets are 48 × 48 minimum.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
