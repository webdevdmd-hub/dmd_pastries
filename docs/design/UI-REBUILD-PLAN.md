<!-- /autoplan restore point: ~/.gstack/projects/webdevdmd-hub-dmd_pastries/main-autoplan-restore-20260817-101718.md -->

# UI/UX rebuild — execution plan

Status: **draft, under review**
Branch: `main` · Created: 2026-08-17

Wraps [DESIGN.md](../../DESIGN.md) (what it should look like) and [MIGRATION.md](MIGRATION.md) (how to move the token layer). This document is the third thing neither covers: **the order in which 147 routes and 584 components actually get rebuilt, by whom, and how we know it worked.**

---

## 1. Goal

**Near-term: our own bakery staff make fewer mistakes on this product.**
**Later: it looks like something another bakery would pay for.**

This ordering is deliberate and it is the single most important thing in this document. Pastries POS is currently dogfooded internally — we run our own operation on it, and there is no payment gateway, pricing page, or sales funnel because we are not selling yet. That is by design, not an oversight.

Two consequences:

- Anything that causes a **wrong charge, wrong number, or wrong action** at our own counter is urgent today, not at the end of a 41-day sequence.
- Anything only a **prospect** would notice — dark mode, marketing polish, empty-state copy on modules our tenant already has data in — is real work with a deferred payoff. It stays in the plan; it does not go first.

### Definition of done

1. Zero raw Tailwind palette utilities, zero hardcoded hex in `className`. Enforced, not aspirational (§6).
2. Counter register has no tap target under 48px, asserted by a test so it cannot regress. **"Counter register" includes the six POS dialogs and `/dashboard/cashier`, not just the `(pos)` route group** (§9.1). The assertion runs in CI-equivalent tooling: `pnpm test` is added to `pnpm verify`, which today runs typecheck/lint/no-any/format and would never execute this test (§9.5).
3. Every route that renders a collection has **five** visibly distinct treatments: loading, empty, filtered, failed, and partial. "Visibly distinct" is the acceptance criterion; "designed" is not checkable.
4. Landing and login carry the threshold treatment. `three` is gone from `package.json`.
5. Visual regression baselines exist for the 34 routes the harness covers, in light mode, captured **before** the first token change, **and each one is verified to be a real rendered page rather than an error screen** (§10.1). "Files exist" is not the criterion; the first attempt satisfied that and captured nothing.
6. Token layer is dark-ready. Dark mode itself is explicitly **not** in this plan (see Non-goals).

### Non-goals

- **Dark mode.** Cut from the DoD deliberately. Nobody at a bakery counter needs it, and it doubles QA across 147 routes. The v3 token layer already carries measured dark values (DESIGN.md §3.5), so this is a later addition, not a later rewrite. Revisit when the sellable phase starts.
- Rewriting business logic, data fetching, or backend contracts. Presentation only, **with two named exceptions**: the `(pos)` tap-target changes alter cashier error rates and get behavioural review, and table-density persistence needs a storage decision (§4, C-prereqs).
- Command-palette navigation. Deferred to its own spec (DESIGN.md §10).
- RTL / Arabic. Confirmed out of scope by the owner. It is a separate workstream (bidirectional layout across 147 routes, Arabic type, RTL tables), not a polish item folded in here.
- Thermal receipt print stylesheet. Own constraints, own spec.
- Mobile breakpoints for the 146 non-POS routes. Real and unfunded; recorded in TODOS.md.
- Payment gateway, pricing page, analytics. Not this plan, and not needed while dogfooding.

---

## 2. What already exists

Do not rebuild these.

| Asset                                         | State                                                                                                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DESIGN.md` v3                                | Complete. Every token measured in both modes.                                                                                                                                                              |
| `docs/design/tokens.css`                      | **v3 as of A0.6.** Names and values reconciled with DESIGN.md; dark block present but unshipped so the layer is dark-ready.                                                                                |
| `docs/design/tailwind.config.proposed.ts`     | **v3 as of A0.6.** Aliases `brand-*`/`workspace-*` and keeps `background`/`accent.*` pointing at `--canvas`/`--money-*`, so `components/ui/*` renders unchanged.                                           |
| `frontend/scripts/check-token-agreement.mjs`  | **New in A0.6.** Asserts every `var(--x)` the config wants is declared by the token layer. In `pnpm verify`.                                                                                               |
| `docs/design/preview-v3.html`                 | Working reference for both registers, both modes.                                                                                                                                                          |
| `frontend/eslint.design-plugin.mjs`           | **New in A0.2.** Seven independently named rules with per-rule severity. `no-solid-as-text` and `no-disabled-as-content` are at `error` and blocking; the other five are `warn`.                           |
| `.githooks/pre-push`                          | **New in A0.3.** Chains Git LFS first, then `pnpm verify && pnpm test`.                                                                                                                                    |
| `frontend/scripts/visual/`                    | `capture.mjs`, `compare.mjs`, `routes.mjs` + baseline/current dirs. Covers **34 routes, not 147**, deliberately, and `compare.mjs` exits 0 on changed pixels — it is advisory by construction, not a gate. |
| `frontend/src/components/ui/`                 | 21 shadcn primitives. Restyle, do not replace.                                                                                                                                                             |
| `getting-started-checklist.tsx`               | First-run UX already built. Restyle only.                                                                                                                                                                  |
| Global error boundary + chunk-reload provider | Shipped 2026-08-11. Leave alone.                                                                                                                                                                           |

**The single most important fact:** the design system has been specced twice and applied zero times. v2 landed 2026-08-14 and moved nothing in three days while drift grew by 38 utilities. This plan is judged on whether code changes, not on whether a document is written.

---

## 3. Where the drift actually is

Measured 2026-08-17. This reorders MIGRATION.md's priorities.

| Directory                   | Raw palette utils | Hex    | Files | Note                                                  |
| --------------------------- | ----------------- | ------ | ----- | ----------------------------------------------------- |
| `components/pos/`           | **355**           | 4      | 25    | Worst offender, and it is the Counter register        |
| `components/manufacturing/` | 271               | 1      | 22    |                                                       |
| `components/accounting/`    | 181               | 1      | 16    |                                                       |
| `components/purchasing/`    | 172               | 0      | 47    |                                                       |
| `components/reports/`       | 158               | **83** | 137   | Largest dir; hexes are Recharts literals              |
| `components/super-admin/`   | 141               | 3      | 11    | Internal-only, lowest priority                        |
| `components/settings/`      | 101               | 0      | 12    |                                                       |
| `components/orders/`        | 92                | 0      | 26    |                                                       |
| everything else             | ~478              | ~200   | ~288  | `app/page.tsx` + `components/home/` hold the 3D hexes |

**Two things this changes versus MIGRATION.md:**

1. **POS is its own workstream, not a line item in Phase 7.** 355 utilities in 25 files, plus the 48px tap-target work, plus the highest business risk in the app.
2. **Reports is 137 files and 55 of the 147 routes.** It needs its own pass with its own owner, and the chart-palette bridge is a hard dependency for it.

---

## 4. Workstreams

Five tracks. A, B, C are sequential. D and E run in parallel with them by a second person.

### Track A0 — Ship something today (before anything else)

The pattern this plan is judged against is that v2 and v3 produced documents, not diffs. A0 breaks it: the first commit of this effort changes app code and makes the guardrails real.

| #     | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status                                                                                                                           | Effort (human / CC) |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| A0.1  | **POS card safety fix.** `pos-product-card.tsx`: `h-7`→48px on the Variants button, `font-black`→500 (×4), the 9.9px uppercase labels→`text-xs` sentence case, `tabular-nums` on the price, dot + `aria-label` on the out-of-stock badge. No token layer needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **shipped 2026-08-17** (18→8 lint warnings)                                                                                      | 1h / 10m            |
| A0.2  | **Make the ratchet real — as a 7-rule plugin, not a flag.** Split `designRules` into a local flat-config plugin with seven independently named rules (`design/no-raw-palette`, `no-hex-in-class`, `no-heavy-weight`, `no-uppercase`, `no-sub-12px`, `no-solid-as-text`, `no-disabled-as-content`), each a thin wrapper over the existing selector array. Rules a phase has cleared → `"error"`, which fails `eslint` with exit 1 and blocks the commit through `lint-staged` **for free, per rule, on MIGRATION.md's actual flip schedule**. Rules not yet cleared stay `"warn"`. `--max-warnings 0` becomes the _last_ step, after E2, when the warn set is empty. Ship `no-solid-as-text` and `no-disabled-as-content` at `error` immediately — both are near-clean today, so the ratchet is real and blocking on day one.                                                                                                                                                                                   | **shipped 2026-08-17** (2 rules at error, 0 violations)                                                                          | 1h / 15m            |
| A0.3  | **`pnpm verify && pnpm test` in a new `.githooks/pre-push`, chaining Git LFS first.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **shipped 2026-08-17** (LFS chained, verified)                                                                                   | 1.5h / 20m          |
| A0.4  | **Capture baselines now**, on the 34 routes the harness covers, before any token change. After A1 lands there is no recoverable record of the pre-migration appearance. One-way door — and `capture.mjs:154` `rmSync`s the output dir unconditionally, so a stray `pnpm visual:baseline` re-opens the door in the wrong direction. **Commit `frontend/visual/baseline/` to git immediately after.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **shipped 2026-08-17 as `7f637b1`, and it captured nothing — see A0.4′.** All 35 files are `ERR_CONNECTION_REFUSED` screenshots. | 2h / —              |
| A0.4′ | **Capture a post-A1′ baseline, and make the harness refuse to write a broken one.** P0; it blocks Track B's only non-manual gate. (a) **Capture from the current `design-system-v3` tree, not from `ce01f74`** — the pre-migration appearance is the wrong reference for Track B, see §10.1. Needs the dev server up and a hand-established headed login session. Commit over `frontend/visual/baseline/`. (b) Harden `capture.mjs`. It already guards a `/login` redirect (`:192`) and a missing file, and neither fires for a dead origin: Chrome renders its error page, `screenshot` writes a valid PNG, and the trailing `url` step returns a correct localhost URL, so every route logs `ok`. Add a **preflight** aborting the run if the origin does not answer, plus a per-route assertion that an app root exists — not merely that a file was written. (c) Reject a degenerate set: if distinct image hashes number fewer than half the captures, fail. Any one of the three would have caught A0.4. | **shipped 2026-08-17 — 35 captures, 33 distinct, smallest 85KB (was 4.8KB). Four guards, not three: see §10.8.**                 | 1.5h / 20m          |
| A0.4″ | _(optional, archival)_ Pre-A1′ baseline from `ce01f74` in a throwaway worktree, for the before/after record only. Costs its own `pnpm install`. **Not a gate** — do it if the record is wanted, skip it otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | optional                                                                                                                         | 2h / —              |
| A0.5  | Create `TODOS.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **shipped 2026-08-17** (15 items, T-A…T-O)                                                                                       | —                   |
| A0.6  | **Reconcile `tokens.css` and `tailwind.config.proposed.ts` to v3 names and values** before A1 runs. See A2.1 for why; this is the pure-docs half, done first so A1 becomes mechanical.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **shipped 2026-08-17** (`pnpm check:tokens`)                                                                                     | 45m / 10m           |

**Note on A0.2 — two rejected designs, and why.**

The first draft proposed a `.design-debt.json` counter script run from `pnpm verify`. Rejected: `pnpm verify` is invoked by nothing in this repo — not the pre-commit hook (which runs `lint-staged`), not CI (there is none), not the Dokploy deploy. It reproduced the exact enforcement model that failed between 2026-08-14 and 2026-08-17.

The second draft proposed `--max-warnings 0` on the `lint-staged` eslint call. Also rejected, for a subtler reason: all seven guards live in **one** `no-restricted-syntax` entry (`eslint.config.mjs:84`), ESLint resolves one severity per rule id, and `--max-warnings 0` is a single global integer. There is no per-rule granularity, so it cannot phase — it turns all seven on at once. Measured: **300 of 938 `.ts`/`.tsx` files under `src/` (32%)**, and **22 of 25 files in `components/pos/`**, would become un-committable on day one. The third time someone hits that during an unrelated accounting fix, they type `--no-verify`, and the ratchet is dead by exactly the mechanism `capture.mjs` warns about for the visual harness.

The plugin has real per-rule severity, is ~30 lines, costs _less_ than the flag's estimate, and matches the flip table MIGRATION.md calls "the contract."

**Note on A0.3 — this is not "zero installer changes."** `.git/hooks/pre-push` currently **is** the Git LFS hook, and `install-hooks.mjs:47` does an unconditional `copyFileSync` over every file in `.githooks/`. Dropping a naive `pre-push` there silently stops LFS object upload — pointer files land on the remote with no blobs, discovered later when a tracked file won't check out elsewhere. The installer's own header comment names this exact hazard for `core.hooksPath`; the copy path reaches the same outcome. The new hook must chain LFS first:

```sh
#!/bin/sh
set -e
command -v git-lfs >/dev/null 2>&1 && git lfs pre-push "$@"
git diff --name-only @{u}.. 2>/dev/null | grep -q '^frontend/' || exit 0
cd "$(git rev-parse --show-toplevel)/frontend"
command -v pnpm >/dev/null 2>&1 || exit 0
pnpm verify && pnpm test
```

`pnpm test` is included deliberately: `verify` is `typecheck && lint && check:no-any && format:check` and has never run the five existing test scripts, nor the tap-target test DoD #2 depends on.

### Track A — Foundation (blocking)

| #    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Effort (human / CC) |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| A1′  | **One commit. Tokens, config, and every dependent deletion together.** Splitting them is what breaks the app. Contents: (a) land v3 token values in `globals.css`; (b) copy `tailwind.config.proposed.ts` over `tailwind.config.ts` — _the alias layer is A1's entire safety net, so it cannot land a commit later_; (c) delete the hand-written utilities (**26 classes, not ~120** — counted: 15 `brand-*`, 10 `workspace-*`, 1 `shadow-workspace`) and `.font-display`/`.font-sans`; (d) **rewrite the `body` rule at `globals.css:83-87`** — it holds `background-color: rgb(var(--workspace-canvas))`, which sits outside every range the plan previously named and would silently drop the page background app-wide; (e) codemod the **24 live `font-display` usages** to `font-serif`, since the proposed config defines no `display` family and Tailwind emits nothing for an unknown class; (f) delete the pistachio variable block (`42-73`) _and_ its override block (`348-408`) together — splitting them across A1 and B3 leaves a hardcoded `#102418` sidebar forced over light tokens for the whole B1→B3 window. **Acceptance criterion, mechanized (see §6):** `check-utility-coverage.mjs` resolves every deleted name against the new theme. | 3h / 40m            |
| A2   | _(merged into A1′)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                   |
| A2.1 | **Reconcile token names before A1/A2 run. This is a second silent-failure path of exactly R2's kind and R2 does not cover it.** Three documents use two naming sets. DESIGN.md v3 §3.1/§3.2 names `--canvas` and `--money-solid` / `--money-text` / `--money-tint`. `docs/design/tokens.css` (still headed "v2") and `tailwind.config.proposed.ts` name `--background` and `--accent-solid` / `--accent-hover` / `--accent-text` / `--accent-tint`, and carry v2's _values_ (`#FCFCFC`, `#737373`, `#8F8F8F`). If A1 lands v3 names and A2 copies the v2-named config, every colour utility resolves to `oklch(var(--canvas))` where the var is undefined — invalid CSS, no build error, no lint error. **Decision, per CLAUDE.md document precedence (DESIGN.md wins on tokens): v3 names are canonical.** Rewrite `tokens.css` to v3 names and v3 values; in the Tailwind config keep `background` and `accent.*` as deprecated aliases pointing at `--canvas` / `--money-*`, exactly as `brand-*` is aliased, because shadcn's `components/ui/*` references `accent-foreground`. Acceptance: `grep -o 'var(--[a-z-]*)' tailwind.config.ts` and the `--` declarations in `globals.css` produce identical sets.                                                | 0.5d / 20m          |
| A3   | Font swap: Manrope + Cormorant → Geist + Geist Mono + Fraunces (`subsets: ["latin"]`). Fixes the 31 files where `font-mono` resolves to nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 0.5d / 15m          |
| A4   | Remove global `html { scroll-behavior: smooth }` (`globals.css:80`); scope to marketing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 0.5h / 5m           |
| A5   | Contrast-assertion script over the token pairs. §6 promised this and no track built it. **Three corrections.** (a) _Light mode only_ — dark mode is cut, the `.dark` block will not exist, and a script that asserts both modes fails on a missing block. Write the mode as a parameter so T-A turns it on with no rewrite. (b) The allowlisted `foreground-disabled` figure **3.15:1 is v2's `#8F8F8F`**; v3's value is `#A8A29A` at **2.40:1** (DESIGN.md §3.1). Allowlist the token, not the number. (c) Assert each semantic `-text` against **its own tint and against `--card` and `--muted`**, not against `--canvas` — the v2 defect this whole exercise corrected (`#737373` passing on white and failing at 4.35:1 on `--muted`) is invisible to a canvas-only script, so a canvas-only script would have shipped the bug it exists to catch.                                                                                                                                                                                                                                                                                                                                                                                                         | 0.5d / 20m          |

**Gate:** `pnpm build` passes, all 147 routes render, A0.4 baselines diff cleanly except for the expected type change.

### A1′ execution brief — read this before touching anything

**Status: shipped 2026-08-17 as `bd417b6` ("feat(design): apply the v3 token layer"), plus `bc8e93a` correcting three stale preview values. Kept below as the record of what it did and why it was one commit.**

**Caveat on its verification.** Step 3 below tells you to diff against the committed baselines. Those baselines are error pages (§10.1), so that step did not run meaningfully and A1′ has no visual evidence behind it. Steps 1, 2, 4 and 5 stand. Re-run step 3 once A0.4′ lands.

This is the highest-risk commit in the plan. Its failure mode is silent: an
undefined custom property inside `oklch()` or `rgb()` is invalid at
computed-value time, so the browser drops the whole declaration. No build
error, no lint error, no console warning. `pnpm build` goes green and Dokploy
serves a blank surface, because a failed build there leaves the previous
container answering 200 anyway.

**Prerequisite: the dev server must be running.** The only detector for the
failure above is loading a page and looking at it.

#### Everything in ONE commit. Splitting it is the bug.

|     | Change                                                                                                                 | Why it cannot be a separate commit                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | v3 token values into `globals.css` `:root`                                                                             | —                                                                                                                                                                                                                                                                                                                                        |
| b   | `docs/design/tailwind.config.proposed.ts` → `frontend/tailwind.config.ts`                                              | The alias layer is (a)'s entire safety net. One commit later and every `brand-*`/`workspace-*` utility in 584 components is invalid.                                                                                                                                                                                                     |
| c   | Delete the hand-written utilities (**26 classes**, `globals.css` ~242-346) and `.font-display`/`.font-sans` (~410-416) | They read `rgb(var(--brand-*))`. After (a) those are oklch triplets, so `rgb(0.98 0.003 84.6)` is invalid.                                                                                                                                                                                                                               |
| d   | Rewrite the `body` rule (~83-87)                                                                                       | It holds `background-color: rgb(var(--workspace-canvas))` and `@apply text-brand-espresso`, **outside every range this plan originally named**. Replace with `background: oklch(var(--canvas)); color: oklch(var(--foreground));` — the exact rule already written in `tokens.css`. This is the single highest-probability silent break. |
| e   | Font swap: Manrope + Cormorant → Geist + Geist Mono + Fraunces                                                         | The new config maps `font-serif` → `var(--font-serif)`, which does not exist until this lands. This was originally sequenced as a separate A3 and that ordering was wrong.                                                                                                                                                               |
| f   | Codemod 24 live `font-display` usages → `font-serif`                                                                   | Depends on (e). The proposed config defines no `display` family, and Tailwind emits nothing for an unknown class — the 24 headings would silently fall back to sans.                                                                                                                                                                     |
| g   | Delete the pistachio variable block (~42-73) **and** its override block (~348-408) together                            | Splitting them across A1′ and B3 leaves a hardcoded `#102418` sidebar forced over light tokens for the whole intervening window. Check no tenant is on `data-theme="pistachio"` first.                                                                                                                                                   |

Scope Fraunces to the threshold layouts with `preload: false` rather than
putting all three font variables on `<html>` — it is threshold-only per
DESIGN.md §2, and preloading a two-axis variable serif on `/pos` over bakery
wifi is the wrong trade.

#### Line numbers in the table above are indicative, not authoritative

Three of the four ranges this document originally carried were already wrong
against the file. Locate each block by its content, and consider replacing the
ranges with anchor comments while you are in there.

#### Verification, in order

1. `cd frontend && pnpm check:tokens` — every `var(--x)` the config wants is declared. Should pass before you start and after you finish.
2. `pnpm build` — proves nothing about CSS validity, but catches the PostCSS parse errors that mis-cut ranges produce.
3. `pnpm visual:diff` against the committed baselines. Advisory, not a gate: `compare.mjs` exits 0 on changed pixels by design. Expect a visible type change everywhere — that is (e) working. Look for _missing backgrounds_, which is (a)/(c)/(d) failing.
4. **Load `/pos`, `/accounting/reports/trial-balance`, `/login` in a browser.** Confirm backgrounds actually paint and the sidebar is styled. Nothing else catches a dropped declaration.
5. `pnpm lint` — the two `error`-severity design rules must still report zero.

#### Known traps

- **Bulk in-place rewrites break the Tailwind 3.4 watcher.** The dev server 500s on every route with a `statSync` ENOENT that touching `globals.css` does not clear. Only a restart does. Do not chase it as a code bug.
- `workspace-panel-border` is used 18 times and has never existed in any config. Deliberately not aliased — adding it would be a visual change smuggled into a migration-neutral commit. Decide it here, with eyes on the screens.
- `shadow-workspace` has 0 usages in `src/` despite the config comment claiming otherwise in the other direction. Safe to drop.

#### After A1′

Track B codemods, starting with B1 — which is **blocked on a contradiction**:
MIGRATION.md maps `text-red-600` → `text-danger`, and `design/no-solid-as-text`
now bans exactly that at `error` severity. The rule is right and the mapping is
wrong; fix the mapping to `text-danger-text` before running B1, or the codemod
will fail the commit it is trying to make.

---

### Track B — Codemods (mechanical, high volume, low risk)

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Effort     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| B1  | Semantic codemod: the 514-occurrence red/amber/green/blue cluster → `danger`/`warning`/`money`/`info` tint+text pairs. Biggest single win. **Blocked on a contradiction:** MIGRATION.md's Phase 2 table maps `text-red-600`→`text-danger`, which design rule 6 bans (`-solid` values are fills, never text). Reconcile before running, or the codemod emits 100+ new violations that are invisible at `warn`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 1d / 30m   |
| B2  | Neutrals codemod, **one PR per colour family** (`zinc`, then `neutral`, then `slate`/`gray`). A single 1,900-line diff is unreviewable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 3d / 1.5h  |
| B3  | Retire `brand-*` (2,641 refs) and `workspace-*`. Delete the ~50 pistachio override lines and the ~120 hand-written `.bg-brand-*` utilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 1.5d / 45m |
| B4  | Typography: 78 `font-black` → 500; kill in-app uppercase+tracking; sub-12px → `text-meta`; `tabular-nums` on every money/count/date/percent cell.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2d / 1h    |
| B5  | `src/lib/design/palette.ts` bridge; replace the 83 Recharts hexes in `components/reports/` and 41 in `components/dashboard/`. **Add a verification step:** `chartSeries` is commented "distinguishable under deuteranopia and protanopia" with nothing checking it, and it is the one place in the system where colour genuinely is the only carrier of meaning (a line chart has no dot to fall back on). Simulate the six series through a deuteranope/protanope transform and assert adjacent-pair ΔE, or give every series a dash pattern or marker shape as well.                                                                                                                                                                                                                                                                                                                                                                                                 | 1.5d / 45m |
| B6  | **Motion, elevation, and the mono/sans money split** — three DESIGN.md sections no track implemented (§9.3). Motion (§5): card hover becomes a 1px lift + `--shadow-sm`, not a border-colour change; 150ms `cubic-bezier(.2,0,0,1)` on hover/focus/colour, 200ms on panels, **0ms on anything that blocks a tap**. Elevation (§4): repoint `shadow-float` (15 files) and `shadow-panel` (3) onto `--shadow-md`/`--shadow-xs`. MIGRATION.md orphans these to Phase 8, which is dark mode, which is cut — so today nobody owns them. Radius `0.875rem`→`0.625rem` is a global visual change riding inside A1; call it out at the A0.4 baseline diff rather than discovering it. Mono rule (§2): money **in a table** is Geist + `tabular-nums`, money **at the counter** is Geist Mono, identifiers are Geist Mono left-aligned. B4 adds `tabular-nums` but never makes this split, so a codemod that mono-izes every price makes the Ledger tables wider for no reason. | 1.5d / 45m |

**Gate after each:** visual diff against A6 baselines. Codemods should be pixel-neutral except where a token intentionally differs.

### Track C — Screens (the actual rebuild)

Ordered by business risk, not by file count.

| #   | Module                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Files  | Effort    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------- |
| C1  | **POS / Counter register.** 48px targets, `data-density="counter"`, mono readout, segmented payment control. **Scope corrected — see §9.1.** The register is not the `(pos)` route group: it is `(pos)` **plus the six portalled POS dialogs** (`pos-checkout-dialog`, `pos-create-order-dialog`, `pos-hold-sale-dialog`, `pos-quick-customer-dialog`, `pos-receipt-dialog`, the variants sheet) **plus `app/(dashboard)/dashboard/cashier`**, which MIGRATION.md Phase 7 currently hands to `data-density="ledger"` in contradiction of DESIGN.md §1. Also replace `bg-[#f9f9fa] text-zinc-950` on `app/(pos)/layout.tsx:34`. | 25 + 1 | 4d / 2h   |
| C2  | Accounting + its 5 report routes. `data-density="ledger"`, table density modes, mono account codes, totals rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 16     | 2d / 1h   |
| C3  | Reports (55 routes, 137 components). Table density, chart palette, export surfaces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 137    | 5d / 2.5h |
| C4  | Purchasing + Orders + Payments.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 97     | 3d / 1.5h |
| C5  | Inventory + Manufacturing + Recipes + Ingredients + Packaging.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 92     | 3d / 1.5h |
| C6  | Products, Customers, Suppliers, Settings, Users, Roles, Branches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 105    | 3d / 1.5h |
| C7  | Super-admin. Internal-only; last.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 11     | 1d / 30m  |

**Component prerequisites (C0), built once at the head of Track C.** These were a prose bullet with no estimate in the first draft, which hid unbudgeted work inside the largest track.

| #     | Component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Effort     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| C0.1  | `button.tsx` rebuilt: `commit` variant, drop filled `secondary`, focus ring `ring-brand-caramel`→`ring-ring`, `font-semibold`→500, `rounded-xl`→`rounded`. **Two things the 0.5d estimate hid.** (a) Today's `default` size is `h-11` (44px) and `lg` is `h-12`; DESIGN.md §6 makes default 36px. That is a global vertical-rhythm change across every screen in the app, not a variant tweak — it belongs behind the A0.4 baselines and its own visual pass. (b) There is no `counter` (48px) size at all, and C1's DoD depends on one. Sizes become `sm` 32 / `default` `h-control` / `lg` 44 / `counter` 48. **Keyboard-navigation verification is now C0.1b, not T-J** — a focus-ring change across 584 components with no verification step is the definition of an unowned regression. | 1d / 40m   |
| C0.1b | Keyboard-navigation and focus-order pass on the routes C1 and C2 cover, plus the six POS dialogs (focus trap, initial focus, Escape, restore-on-close). Promoted out of TODOS.md T-J because C0.1 causes the regression it verifies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 0.5d / 20m |
| C0.2  | Segmented control primitive (POS payment method, table density, date range).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 0.5d / 20m |
| C0.3  | Three-mode `table.tsx`. **Decided: `localStorage`,** key `pastries-pos-table-density`, with a forward-compatible reader (unknown value → `"default"`, never throw) — the same contract §5 specifies for the theme key. Keeps C0.3 inside the presentation-only boundary: no backend contract, no migration, no contention with the accounting roadmap. Density becomes a property of the terminal rather than the person, which is right for shared counter hardware. Revisit only if accountants routinely switch machines.                                                                                                                                                                                                                                                                 | 1d / 30m   |
| C0.4  | Badge with dot (the dot carries state for colour-blind users, so it is not decoration).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2h / 10m   |
| C0.5  | Skeleton/loading treatment, one per register. **Loading appears in zero of the five tracks in the first draft** — and on counter hardware over bakery wifi it is the most-seen transient state in the app. **Correction: this is not greenfield.** 96 files already render `Skeleton` or `animate-pulse` ad hoc (`pos-product-grid-skeleton.tsx`, `components/shared/loading-state.tsx`, and 94 others). Building the primitive without sweeping them leaves two loading languages. The sweep is E4.                                                                                                                                                                                                                                                                                         | 0.5d / 20m |
| C0.6  | **Confirm-before-irreversible primitive.** The app has **zero** `AlertDialog` usages and 103 `toast` call sites: every destructive action — void a sale, refund, post a journal entry, close a period, delete a product — either fires immediately or confirms through ad-hoc markup. The plan's stated near-term goal is "our own staff make fewer mistakes," and this is the one surface that exists solely to prevent a mistake. `danger` variant, the consequence stated in the body ("This voids sale #1042 for AED 75.60 and posts a reversing entry"), destructive action never the default-focused button.                                                                                                                                                                           | 0.5d / 20m |
| C0.7  | **Toast/notification token pass.** 103 call sites are the app's real failure surface. A failed charge at the counter is a toast, not the `failed-state` panel E1 builds. Success/danger/warning variants on the semantic pairs, and never the only report of a failure that lost data. **Corrected from "≥6s for anything money-related": money failures are persistent until acknowledged, and the first line states the money verdict** ("No payment was taken"), because the cashier's only real question is whether the customer was charged, and a timer on that question is how a sale gets rung twice. Classify all 103 sites into money (persistent), operational (6s), confirmation (3s). Design: §10.4.                                                                            | 0.5d / 25m |

### Track D — Threshold (split by decision, 2026-08-17)

**D1 and D4 stay at the front. D2, D3 and D5 move below Track E.** Under "our own staff make fewer mistakes," the landing page has an audience of zero and login is four seconds a shift, so ~3.5 days there buys nothing internal while C0.6 and E5 buy exactly the stated goal. D1+D4 stay because they are ~1h of pure subtraction that removes 87 hexes, four dependencies, and a CSS range that currently breaks the build if mis-deleted.

**Correction to D4's framing:** `bakery-door-scene` is already `next/dynamic` with `ssr: false` and is imported only from `app/page.tsx`, so webpack already splits it into a chunk fetched on `/` alone. The authenticated app shell carries **zero bytes** of three.js today. D4 is a landing-page win and a dependency/build win — not the app-shell win MIGRATION.md and the first draft both claimed. Keep it; just don't expect `/pos` to get faster.

**Correction to D1's range:** deleting exactly `globals.css:95-160` orphans `animation: auth-scan 8s…; }` at lines 161-162 and breaks the PostCSS parse. The range is 95-162, or 95-194 if `.auth-glass-card` / `.auth-login-frame` go with D5. More generally: every line-number range in this document is a bug waiting for the next edit to the file it points at — three of four were already wrong. Replace them with anchor comments.

| #   | Item | Effort |
| --- | ---- | ------ |

| #   | Item                                                                                                                     | Effort     |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| D1  | Delete auth orbs + scanline (`globals.css:95-160`).                                                                      | 1h / 5m    |
| D2  | Login ledger motif per DESIGN.md §7. Resolves once, holds, honours reduced-motion.                                       | 0.5d / 20m |
| D3  | Rebuild `app/page.tsx` on the threshold structure.                                                                       | 1.5d / 45m |
| D4  | Delete `components/home/` (901 lines, 4 files); drop `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`. | 0.5d / 15m |
| D5  | Auth routes (login, signup, forgot, reset, verify, accept-invitation) on the threshold register.                         | 1d / 30m   |

**Blocked on:** one photograph of a real counter. Ship type-only until it exists; still better than the door scene.

### Track E — States (parallel, independent)

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Effort     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| E1  | `empty-state.tsx` with `register` prop, plus `filtered-state` and `failed-state` siblings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 1d / 30m   |
| E2  | Sweep all 147 routes. One PR per module group, tracked against a checklist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 4d / 2h    |
| E3  | Restyle `getting-started-checklist.tsx` to tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 0.5d / 15m |
| E4  | **Loading sweep.** Replace the ad-hoc `Skeleton` / `animate-pulse` treatments in the 96 files that already have one with C0.5's register-aware primitive. Same PR-per-module-group shape as E2. Without this, C0.5 adds a third loading language rather than replacing two.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 2d / 1h    |
| E5  | **Partial and offline states.** Two states nothing in the plan covers and both hit the counter hardest: a list that loaded page 1 of N and failed on page 2 (today: silence or a spinner that never ends), and a request made with no network. 25 files already reference `onLine`/`offline` ad hoc. One inline `--warning-tint` strip with Retry for partial; one persistent `--danger-tint` bar for offline. **Widened after design review: the bar is not sufficient.** A cashier can look past a banner during a rush, so offline must also **disable every money-committing control with the reason stated inline** ("Charging is off while the till is offline. The cart is saved."), owned by one connectivity provider that the counter layout and all six POS dialogs subscribe to. An indicator informs; only a disabled Charge button actually stops sales being rung into nothing, which is the stated failure. Partial gets both counts (`50 of 214`) and must mark any totals row incomplete — a partial list under a confident total is worse than an error. Design: §10.4. | 1.5d / 40m |

---

## 5. Sequencing

```
A0.1 ─► A0.2 ─► A0.3 ─► A0.4 ─► A0.5     (ship today; A0.4 is a one-way door)
  │                                ║
  └─ shipped 2026-08-17            ║
                                   ▼
              A1 ─► A2 ─► A3 ─► A4 ─► A5  ═══╗  (foundation gate)
                                              ║
                             ┌────────────────╨────────────────┐
                             │                                 │
            B1 ─► B2 ─► B3 ─► B4 ─► B5                D1..D5   E1 ─► E2 ─► E3
                             │  (codemods)            (thresh)  (states)
                             ▼
       C0.1..C0.5 ─► C1 ─► C2 ─► C3 ─► C4 ─► C5 ─► C6 ─► C7
                                   ▲
                                   └── B5 (palette bridge) required
```

**Hard dependencies:** A0.4 baselines before A1, or no pre-migration record ever exists. C after B and after C0. B5 before C3. Everything after A.

**Dark mode is not in this graph.** Cut from the DoD (§1). When it returns it goes after B3, because redefining tokens is only safe once nothing bypasses them, and it carries MIGRATION.md Phase 8 in full — including the `pastries-pos-theme` localStorage migration, which is this plan's only irreversible change and needs a forward-compatible reader (unknown value → `light`, never throw).

**Guardrail flips** (from MIGRATION.md): palette rule → `error` after B2. `font-black`, uppercase, sub-12px → after B4. hex → after B5. `--max-warnings 0` repo-wide → after E2. **Restated to match A0.2's correction:** all seven selectors share one `no-restricted-syntax` entry and therefore one severity, so a "flip" is really two moves — the selector enters A0.2's lint-staged array when its fix exists, and the whole entry goes `warn`→`error` once the last selector has cleared. Between those points the per-file ratchet is the only enforcement, which is the intended behaviour, not a gap.

**Escape hatch, decided now so the final flip isn't postponed forever:** legitimate exceptions (the one permitted threshold eyebrow, chart literals in `palette.ts`) use `eslint-disable-next-line` with a required reason comment.

---

## 6. Verification

| Layer       | Mechanism                                                                                         | Runs where                         | When                             |
| ----------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------- |
| Mechanical  | `--max-warnings 0` on the `lint-staged` eslint call                                               | pre-commit hook, already installed | Every commit, from A0.2          |
| Mechanical  | `pnpm verify`                                                                                     | new `.githooks/pre-push`           | Every push, from A0.3            |
| Contrast    | Script over token pairs vs WCAG AA                                                                | `pnpm verify`                      | From A5                          |
| Tap target  | jsdom test asserting nothing under 48px in `(pos)`                                                | `pnpm test`                        | From C1                          |
| Visual      | `pnpm visual:diff` against A0.4 baselines                                                         | manual, headed session             | Each codemod PR — **see caveat** |
| Manual      | Walk the routes MIGRATION.md Phase 1 names, plus `/pos`                                           | manual                             | After A1, after each codemod     |
| Post-deploy | Load `/pos`, `/accounting/reports/trial-balance`, `/login` and confirm backgrounds actually paint | manual                             | Every deploy                     |
| Review      | `/design-review`                                                                                  | —                                  | After C7                         |

**Visual-diff caveat, stated plainly rather than assumed away.** The harness covers **34 routes, not 147** — deliberately, per its own docstring ("biased toward money, dense tables, and the two density extremes rather than toward coverage for its own sake"). More importantly, `capture.mjs` warns in its own header that it renders live data, and _"if the dataset changes between two runs, the diff is red for reasons that have nothing to do with CSS… without that, this tool reports noise and everyone learns to ignore it, which is worse than not having it."_ No frozen dataset exists. On Windows it also needs a hand-established headed session, so it cannot run unattended.

So: the visual gate is a **manual ritual against moving data**, and the first unexplained red diff will kill it. Two honest options, and this needs a decision rather than a wish:

- **Accept it as advisory.** Run it, treat red as "go look," never as a gate. Costs nothing, catches the large breakages, which is most of what A1 risks.
- **Fund a frozen seed dataset** (>1 day, new infrastructure) and expand `routes.mjs`. Only then does "gate on every codemod PR" become true. Note these move together: 147 noisy baselines is strictly worse than 34.

**Why post-deploy verification is not optional here:** pushes to `main` auto-deploy via Dokploy, and a failed frontend build leaves the previous container serving HTTP 200. A green deploy proves nothing. A1's failure mode is invalid CSS that produces no build error and no lint error, so the only thing that catches it is loading a page and looking at it.

---

## 7. Risks

| #   | Risk                                                                                                                                                                                                             | Mitigation                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **This plan joins v2 and v3 unapplied on the shelf.** Highest-probability failure by a wide margin; it has already happened twice.                                                                               | A0 ships app code on day one. A0.2 puts the ratchet in `lint-staged`, which already runs on every commit — unlike `pnpm verify`, which nothing in this repo invokes.                                                                                                                |
| R2  | Token deletion breaks styling silently. `rgb(0.97 0 0)` is invalid CSS with no build error and no lint error.                                                                                                    | **Corrected from the first draft, which sequenced the mitigation after the risk.** A0.4 captures baselines _before_ A1. A1's acceptance criterion is a name-by-name check that every deleted utility has a generated counterpart. Post-deploy page load confirms backgrounds paint. |
| R3  | 1,949-utility diff is unreviewable.                                                                                                                                                                              | One PR per colour family. Codemods pixel-neutral against A0.4 baselines.                                                                                                                                                                                                            |
| R4  | Bulk in-place rewrites break the Tailwind 3.4 watcher — dev server 500s on every route with a `statSync` ENOENT that touching `globals.css` does not clear. Only a restart does.                                 | Documented, and the codemod scripts print the reminder rather than relying on someone re-reading this table. Do not chase it as a code bug.                                                                                                                                         |
| R5  | Landing photograph never arrives, D3 stalls.                                                                                                                                                                     | Ship type-only. D3 blocks nothing. The photograph does not need a customer — any bakery that allows twenty minutes behind the counter will do.                                                                                                                                      |
| R6  | Reports (C3) is 137 files and could swallow the schedule.                                                                                                                                                        | B5 lands the palette bridge first. C3 is one owner, its own PR series.                                                                                                                                                                                                              |
| R7  | **Capacity, not enforcement, is the real reason v2 didn't ship.** 229 of 234 commits are by one author. Every "parallel" track in §4 is in fact serial, and the accounting roadmap competes for the same person. | Honest wall-clock below assumes one person. A ratchet stops drift; it does not create working days. If the schedule slips, the pre-negotiated cut line is §8.                                                                                                                       |
| R8  | Codemod regex matches inside string literals, comments, or test fixtures.                                                                                                                                        | Golden-file unit test per codemod before it runs on the tree. Per-file change log so a bad replacement is greppable rather than archaeology in a 1,900-line diff.                                                                                                                   |
| R9  | `palette.ts` duplicates `tokens.css` values as literals, synced only by a comment. Becomes actively wrong the day dark mode lands.                                                                               | Export `palette(mode)` from the start, not a single light-mode object. Cheap now, expensive after 124 call sites exist.                                                                                                                                                             |

---

## 8. Effort

| Track                | Human      | CC       |
| -------------------- | ---------- | -------- |
| A0 Ship today        | ~0.75d     | ~0.75h   |
| A Foundation         | ~3d        | ~1.5h    |
| B Codemods           | ~10.5d     | ~5.5h    |
| C0 Component prereqs | ~4.75d     | ~2.5h    |
| C Screens            | ~21d       | ~10.5h   |
| D Threshold          | ~4d        | ~2h      |
| E States             | ~8.5d      | ~4.25h   |
| **Total**            | **~52.5d** | **~27h** |

**The total moved from ~44d to ~52.5d in design review**, entirely from work the first two drafts assumed away: token-name reconciliation (A2.1), the motion/elevation/mono-split sections nobody owned (B6), keyboard verification of a focus change across 584 components (C0.1b), confirm and toast surfaces (C0.6, C0.7), the loading sweep (E4), and partial/offline (E5). None of it is new scope — it is scope that was going to surface during implementation instead of during planning. Read it against R7: this is now ~11 weeks of one person's wall clock, which makes §8's pre-negotiated cut line the operative document, not the aspiration.

**Wall-clock is ~44 days, not 31.** The first draft claimed D and E run "in parallel by a second person." 229 of 234 commits on this repo are by one author. There is no second person, so nothing is parallel and the totals add.

**Read the two columns honestly.** The CC multiplier is real for Track B — codemods are exactly what an agent is good at. It is not real for Track C, where the work is judgement about 584 components on screens someone has to look at. And neither column includes the manual gates in §6. Treat ~22h CC as the floor for the mechanical half, not as an alternative total.

### Pre-negotiated cut line

If the schedule slips, cut in this order rather than improvising. This is roughly 40% of the effort for most of the perceived change:

**Keep:** A0, A1-A5, B1-B3 (the 514-cluster plus neutrals plus brand retirement is the visible majority of 1,949), C0, C1 (POS), D1 + D4 (deleting the orbs and `components/home/` is pure subtraction, ~1h, and removes 87 hexes with no design decision), E1 + E2 on list routes only.

**Cut first:** C7 super-admin (11 files, internal-only), then C6, then C3's long tail of report routes, then D3 if the photograph hasn't arrived.

---

## 9. Design review corrections (2026-08-17)

Added by `/plan-design-review`. Everything here is a structural gap — a missing state, a broken register boundary, or a mechanism that does not work as described. Aesthetic calls were left alone.

### 9.1 `data-density` is right, but a layout attribute does not reach a portal

The mechanism is sound: `tokens.css:121-138` defines `--control-h` / `--field-h` / `--tap-min` / `--gutter` / `--card-pad` / `--grid-gap` per register, `:root` safely defaults to `ledger`, and `tailwind.config.proposed.ts` maps them to `h-control`, `h-field`, `min-h-tap`, `p-card`, `gap-grid`. Two things break it in practice.

**A. Portals escape the register.** MIGRATION.md Phase 7 puts `data-density="counter"` on the `(pos)` layout — a `<div>` (`app/(pos)/layout.tsx:33`). Radix portals `dialog`, `sheet`, `popover`, `select`, and `dropdown-menu` to `document.body`, outside that div, where they inherit `:root`'s **ledger** values. Six POS surfaces are dialogs, and `pos-checkout-dialog.tsx` is where money is actually taken. As written, the DoD's "no tap target under 48px in the Counter register" is false on the highest-risk screen in the app, and it fails silently because the vars resolve to _something_.

Fix, explicitly: a `DensityProvider` context that the route-group layout sets, and `dialog.tsx` / `sheet.tsx` / `popover.tsx` / `select.tsx` / `dropdown-menu.tsx` stamp `data-density={useDensity()}` onto their portal content. Setting the attribute on `<html>` instead also works and is one line, but it breaks the moment any counter surface renders inside a dashboard route. Do the provider.

**B. Nothing states the authoring rule, so nothing enforces it.** A density register only works if controls consume the variables. Today `button.tsx:24-27` hardcodes `h-11 / h-9 / h-12 / h-11 w-11`, and a rebuilt button that hardcodes `h-9` is just as density-blind. **Rule: inside `components/ui/*`, control heights and tap minimums come from `h-control`, `h-field`, `h-row`, `min-h-tap`, `min-w-tap` — never a literal `h-*`.** Add it as an eighth ESLint selector scoped to `src/components/ui/`, flipped to `error` after C0. And C0.1 covers one primitive; the register needs all 21 that render a control.

### 9.2 Interaction state coverage

C0.5 and E1 closed loading and the empty/filtered/failed trio. What the plan still does not cover, worst first:

| State                   | Covered?            | What the user gets today                                       | Where it lands      |
| ----------------------- | ------------------- | -------------------------------------------------------------- | ------------------- |
| Loading                 | C0.5 primitive only | 96 files with two ad-hoc treatments                            | C0.5 + **E4 sweep** |
| Empty                   | E1                  | mostly "No items found."                                       | E1/E2               |
| Filtered                | E1                  | identical to empty                                             | E1/E2               |
| Failed (collection)     | E1                  | blank screen or raw error                                      | E1/E2               |
| **Failed (mutation)**   | **no**              | one of 103 toasts, unstyled, 4s, gone                          | **C0.7**            |
| **Partial**             | **no**              | page 2 fails; silence                                          | **E5**              |
| **Offline**             | **no**              | cashier keeps ringing sales into nothing                       | **E5**              |
| **Destructive confirm** | **no**              | `AppConfirmDialog` exists with **zero call sites** — see §10.7 | **C0.6**            |
| Success                 | partial             | toast                                                          | C0.7                |
| Chart empty             | TODOS T-I           | axes with no data                                              | T-I (accept)        |
| Screen-reader parity    | TODOS T-H           | three visual states, one announcement                          | T-H (accept)        |

The last two stay deferred; they are genuinely smaller than the six above.

### 9.3 DESIGN.md sections the plan silently dropped

| DESIGN.md                                          | Status before review                                | Now                                                                               |
| -------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| §1 registers                                       | C1, C2                                              | corrected — see 9.1                                                               |
| §2 families, mono bug                              | A3                                                  | ok                                                                                |
| §2 tracking ladder, semantic scale                 | **dropped**                                         | arrives with A2's `fontSize` block; state it, because B4 never applies the tokens |
| §2 mono vs sans money split                        | **dropped**                                         | **B6**                                                                            |
| §3 colour, §3.4 focus                              | A1, B1, C0.1                                        | ok                                                                                |
| §3.5 dark                                          | cut by owner                                        | TODOS T-A — correct                                                               |
| §4 density, table density                          | C0.3, C1, C2                                        | ok                                                                                |
| §4 radius `0.875`→`0.625`                          | **unstated, ships inside A1**                       | **B6** — call it out at the baseline diff                                         |
| §4 elevation, retire `shadow-float`/`shadow-panel` | **orphaned to MIGRATION Phase 8 = dark mode = cut** | **B6**                                                                            |
| §5 motion (hover lift, 150ms curve, 0ms on tap)    | **only A4's `scroll-behavior`**                     | **B6**                                                                            |
| §6 buttons, segmented, badges, POS tile            | C0.1-C0.4                                           | corrected sizes — see C0.1                                                        |
| §7 threshold                                       | D                                                   | ok                                                                                |
| §8 empty / first-run                               | E                                                   | extended — see 9.2                                                                |
| §9 a11y floor                                      | A5, C1 test                                         | corrected — see 9.4                                                               |

### 9.4 The 48px assertion cannot be a jsdom test

DoD #2 says "asserted by a test." §6 says "jsdom test asserting nothing under 48px in `(pos)`." **jsdom has no layout engine and does not process Tailwind**, so `getBoundingClientRect()` returns zeros and a `className` of `h-control` carries no computed height. The test as specified can only assert on class strings, which means it asserts that someone wrote `h-control` — not that anything is 48px.

Two honest options, pick one rather than discovering this at C1:

- **Static assertion (cheap, ~1h).** Parse `components/pos/**` plus the six dialogs, fail on any literal `h-[0-9]`/`w-[0-9]` below 12 (48px) and on any interactive element with no `min-h-tap`. Catches regressions of the A0.1 class, which is the actual failure mode. Runs in `pnpm test` today.
- **Real measurement (~1d, new infra).** Playwright against `/pos` and each dialog, `getBoundingClientRect()` on every `button`/`a`/`[role=button]`. Actually true, needs the headed session §6 already says cannot run unattended on Windows.

Recommend the static assertion now and the Playwright version bundled with T-B, when a frozen dataset makes a headed run worth standing up.

### 9.5 `pnpm verify` does not run the tests

`frontend/package.json:20` — `verify` is `typecheck && lint && check:no-any && format:check`. `test` is a separate script (line 21). A0.3 puts `verify` in pre-push, so the tap-target test, the contrast script, and every existing test never run on push. Add `pnpm test` to `verify` as part of A0.3, or DoD #2's "so it cannot regress" is untrue.

### 9.6 User journey — the near-term goal has no track tracing it

The plan's goal is "our own staff make fewer mistakes." Every track is organised by _drift volume and file count_; none is organised by _error path_. The one mistake this plan was started over — a 28px button that charges the wrong item — was found by reading a component, not by walking a journey. The journey below is what C1, C0.6, and C0.7 should be checked against.

| #   | Cashier does                  | Feels              | Where it currently breaks                                                                                   | Owner    |
| --- | ----------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Opens `/pos`, queue of three  | rushed             | grid loads with an ad-hoc skeleton; `scroll-behavior: smooth` fights the flick                              | A4, C0.5 |
| 2   | Taps a tile                   | confident          | 28px Variants in the corner (fixed A0.1); out-of-stock badge and Variants can still collide on a 146px tile | T-L      |
| 3   | Adds a variant                | uncertain          | variants sheet is portalled → ledger density → 36px rows (9.1)                                              | C1       |
| 4   | Reads the running total       | wants certainty    | `font-mono` resolves to the OS default; the same till shows different digits on Windows and Mac             | A3       |
| 5   | Takes payment                 | committed          | payment method is two adjacent buttons, the selected one fully black, reading as two primaries              | C0.2     |
| 6   | Charge fails (wifi)           | alarmed            | a 4s unstyled toast, then the cart looks unchanged; no offline indicator                                    | C0.7, E5 |
| 7   | Rang the wrong item           | needs an undo      | void fires with no confirmation and no statement of consequence                                             | C0.6     |
| 8   | Owner reconciles that evening | wants it to add up | trial balance renders without `tabular-nums`; decimals do not align                                         | B4       |

Steps 3, 6, and 7 were the three states with no owner before this review. They are now C1, E5, and C0.6.

### 9.7 Unresolved decisions

The plan already surfaced three (table-density storage in C0.3; visual gate advisory vs funded in §6; the B1/rule-6 contradiction). These are the ones it did not:

| Decision                                                                             | If deferred                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Token naming: v3 `--canvas`/`--money-*` vs the files' v2 `--background`/`--accent-*` | **Decided in A2.1: v3 wins, v2 names survive as aliases.** Left open, A1+A2 land invalid CSS with no error   |
| Density on portals: provider vs `<html>` attribute                                   | **Decided in 9.1: provider.** Left open, POS dialogs ship at 36px                                            |
| Button `default` 44px → 36px, app-wide                                               | Engineer picks one, and either the whole app shifts vertically in an unrelated PR or POS keeps 44px controls |
| Tap-target test: static parse vs Playwright                                          | **Recommended in 9.4: static now.** Left open, DoD #2 is unverifiable                                        |
| `shadow-float` / `shadow-panel` (18 files) retirement, now that Phase 8 is cut       | They live forever as deprecated aliases nobody deletes                                                       |
| Whether `chartSeries` needs non-colour encoding                                      | Colour-blind users read the wrong line on 55 report routes                                                   |
| Whether Track D runs before Track E at all, now the audience is internal             | See the open question below                                                                                  |

### 9.8 Open question for the owner — Track D's position

Not auto-decided, because it reverses a stated ordering.

**What the plan says.** Track D (threshold: login motif, landing rebuild, auth routes, ~4d) runs "in parallel" with B/C/E, and DoD #4 makes it a gate. The cut line cuts D3 only if the photograph never arrives.

**What the review recommends.** Split D. Keep **D1 + D4** exactly where they are — deleting the orbs and `components/home/` is ~1h of pure subtraction that removes 87 hexes, drops four WebGL dependencies, and needs no design decision. Move **D2, D3, D5** (~3.5d) below Track E, and drop DoD #4 from the definition of done to a follow-on milestone.

**Why.** Under "our own staff make fewer mistakes," the landing page has an audience of zero and login is seen once a shift for four seconds. Those 3.5 days buy nothing internal, while E5 (offline at the counter) and C0.6 (confirm before void) buy exactly the stated goal. Track D is the _sellability_ investment, and the plan's own §1 says sellability is later.

**What this might be missing.** Three things, any of which makes the recommendation wrong. The owner may already have the photograph, or a shoot booked, in which case D3 is cheap and perishable. The owner may be closer to showing this to another bakery than "later" implies. And there is a morale argument the review cannot price: after two design systems that shipped nothing, a landing page you can look at may be worth more to finishing this than three days of correctness work nobody can see.

**Cost if wrong.** Small and reversible either way. Deferring D costs a few weeks of an ugly landing page seen by nobody. Keeping D costs ~3.5 days at the front of a 44-day schedule that R7 already says is capacity-bound by one person.

---

## 10. Design review, second pass (2026-08-17)

Added by a re-run of `/plan-design-review` after A0 and A1′ shipped. The first pass (§9) reviewed
the plan's text. This pass reviewed the **artifacts the plan produced**, which is where it found the
P0. Nothing in §9 is reversed.

### 10.1 P0 — the visual baselines are Chrome error pages

`frontend/visual/baseline/` holds 35 PNGs committed as `7f637b1` ("chore(visual): pre-migration
baselines"). Every one of them is a Chrome `ERR_CONNECTION_REFUSED` screenshot. The dev server was
not running when `pnpm visual:baseline` ran, and `capture.mjs` screenshotted the error page and
exited 0.

Evidence, reproducible with one command:

```sh
git ls-tree -r design-system-v3 --format='%(objectname) %(path)' \
  | grep visual/baseline/ | awk '{print $1}' | sort | uniq -c | sort -rn
```

**8 distinct blobs across 35 files.** `login__ledger__light.png`, `pos__ledger__light.png`,
`dashboard-cashier__ledger__light.png` and `acc-trial-balance__ledger__light.png` are byte-identical.
The 8 groups differ only by viewport size.

Why this is the top finding rather than a nit:

- A0.4 is the plan's **declared one-way door** — "after A1 lands there is no recoverable record of
  the pre-migration appearance" — and **A1′ has already landed on top of it**.
- DoD #5 reads as satisfied. Files exist. A record does not.
- A1′'s own verification step 3 ("diff against the committed baselines… look for _missing
  backgrounds_") could not have worked. The highest-risk commit in the plan has no visual evidence.
- §6 predicted that "the first unexplained red diff will kill it" and attributed the risk to dataset
  drift. The actual cause is now committed to git, and it makes **every** route diff 100% red.
- The harness cannot self-report this. `capture.mjs` warns in its own header about noise from live
  data but never checks that a page loaded at all.

**The one-way door matters less than it looked, and that is the useful finding.** A0.4 was framed as
irreversible because A1′ would destroy the pre-migration appearance. True — but _the pre-migration
appearance is the wrong reference for Track B anyway._ A1′ intentionally changed type, radius and
every colour app-wide. Diffing a B2 codemod against a pre-A1′ baseline superimposes A1′'s deliberate
global change on B2's incidental one, so the diff is red everywhere for legitimate reasons and tells
you nothing about the codemod. The gate B1–B6 need is **pixel-neutrality against the tree as it
stands now**, which means a **post-A1′ baseline captured before the first codemod**.

So the sequencing inverts:

- **A0.4′ — capture now, from `design-system-v3`.** Cheap: dev server up, headed session, one run.
  This is the reference Track B is actually gated on, and it must exist before B1.
- **A0.4″ — pre-A1′ capture from `ce01f74`, optional and archival.** Needs a throwaway worktree and
  its own `pnpm install`. Worth it only for a before/after record. `ce01f74` stays reachable as long
  as the history does, so this is not urgent; a squash or rebase is the only thing that closes it.

The fix belongs in the harness, not in a habit. `capture.mjs` already guards the two failure modes
someone thought of; the preflight, the app-root assertion and the degenerate-set check cover the one
nobody did.

### 10.2 A fourth design document, teaching the opposite of DESIGN.md

`frontend/docs/frontend-design-system.md` opens with "This document is the frontend UI contract for
Pastries POS. Every new module should follow this plan," then specifies:

- Creamy Latte `#F3E9D7` as the page background
- Caramel Roast `#B08968` for primary actions
- Warm Cappuccino `#D6BFA6` card tints
- `magicui` for "premium motion moments"

That is the v1 vocabulary DESIGN.md §1 exists to kill, and it names the exact browns (`#B08968`,
`#7A553A`) that MIGRATION.md identifies as **the root cause of the 298 hardcoded hexes**. CLAUDE.md's
document-precedence rule lists three documents; this is a fourth, outside the hierarchy, calling
itself the contract. Any developer or agent who reads it will faithfully re-create the drift Track B
is spending 10.5 days undoing.

**Action:** reduce it to a pointer at DESIGN.md, or delete it. Then add a check that no document
under `frontend/docs/` declares itself a UI contract. This is a five-minute fix guarding a ten-day
investment, and it should land with A0.4′.

### 10.3 §9.5 is still open, and DoD #2 still depends on it

Measured on the current tree — `frontend/package.json:21`:

```
"verify": "pnpm typecheck && pnpm lint && pnpm check:no-any && pnpm check:tokens && pnpm format:check"
```

A0.3 shipped and added `check:tokens`, but **not** `pnpm test`. The pre-push hook runs
`pnpm verify && pnpm test` so pushes are covered, but §6's "Contrast — runs in `pnpm verify`" and
DoD #2's "asserted by a test so it cannot regress" are both still untrue for every other invocation.
One-word fix; it has now survived one review pass, which is how it will survive the next.

### 10.4 The six states now have designs, not just owners

§9.2 correctly identified six uncovered interaction states and assigned each a track item. None had
a visual design, which meant six surfaces would be improvised during implementation — the same
process that produced 103 unstyled toasts and two loading languages.

Drawn at v3 token values in **`docs/design/preview-states.html`** (open it next to
`preview-v3.html`). Every colour is a token from `tokens.css`; none is a new choice. The design
decisions worth carrying into the tickets:

| State                     | Track     | The decision the design makes                                                                                                                                                                                                                                                                                                |
| ------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destructive confirm       | C0.6      | Consequence stated with the identifier **and** the amount in mono tabular figures; the accounting effect named; safe action focused and rightmost; destructive action is outline with `--danger-text`, **never a filled red button**, because a solid red reads as primary and invites the tap it exists to slow. Both 48px. |
| Failed charge             | C0.7      | First line answers the only question a cashier has — "No payment was taken" — in `--foreground` while the rest stays muted. Persistent, not 6s. Confirms the cart survived. Retry is the one `commit`-green control.                                                                                                         |
| Offline                   | E5        | Disables money-committing controls with the reason inline, not just a banner. Says "Sales can't be completed", not "Offline". Undismissable, lives in the layout, promises the cart is saved.                                                                                                                                |
| Partial                   | E5        | Renders at the seam in the list, not as a toast. `--warning`, not `--danger` — something did load. Both counts. Marks the totals row incomplete. Retry loads forward and keeps scroll.                                                                                                                                       |
| Loading                   | C0.5 + E4 | Skeleton is the shape of what arrives: counter tiles at 146×168, ledger rows at 44px on real column widths. No spinners, no shimmer sweep. `prefers-reduced-motion` gets a flat tint, not nothing.                                                                                                                           |
| Empty / filtered / failed | E1 + E2   | Empty is the only one with a primary action. **Filtered must never offer "Add product"** — wrong action, and it implies an empty catalogue when 214 items exist. Failed must say nothing was lost. All three announce differently, which closes `T-H` by construction rather than deferring it.                              |

Two of these change scope, and the estimates in §4 have been updated: C0.7 to 25m CC (the 103-site
classification is real work) and E5 to 1.5d / 40m (the connectivity provider and the disabled-control
contract are more than a banner).

### 10.7 C0.6 is not greenfield — the primitive exists and nothing uses it

§9.2 recorded "zero `AlertDialog` in 584 components". Literally true, and it hid the sharper fact:

```
frontend/src/components/app/app-confirm-dialog.tsx   exists
grep -rl AppConfirmDialog src/                        2 hits — its own file, and the barrel export
```

**`AppConfirmDialog` was built and wired into nothing.** `AppEmptyState` is the same story with one
real consumer. `frontend/docs/frontend-design-system.md:66` even instructs developers to use it. So
the failure was never a missing primitive — it was a primitive nobody adopted, which is a different
problem with a different fix, and building a second one would have repeated the mistake.

What the existing component gets right: `open`/`onOpenChange`/`onConfirm` shape, a `tone="danger"`
variant, `isSubmitting`, `ReactNode` title and description so a consequence line can be passed in.

What it must change to meet §10.4:

- **Button order is inverted.** `Cancel` renders first, `Confirm` last, so `DialogFooter`'s
  `justify-end` puts the **destructive** action at the natural thumb rest. The safe action belongs
  rightmost and focused.
- Defaults are `Cancel` / `Confirm`. Generic labels are what make a confirm dialog reflexive; the
  labels must name the action (`Keep sale` / `Void sale`), so make them required rather than
  defaulted.
- Nothing requires the consequence. `description` is free-form, so "Are you sure?" type-checks.
  Take a required `consequence` prop instead, and the identifier and amount with it.
- Built on `Dialog`, not `AlertDialog`, so it lacks `role="alertdialog"`. Dismiss-on-outside-click is
  acceptable here because dismissing is the safe outcome, but the role should be correct.
- No `counter` (48px) sizing — it inherits `AppButton`, which C0.1 has to fix first for the Counter
  register.

**Revised C0.6:** upgrade and adopt, not build. Cheaper on the component, and the real work is the
call sites — which is exactly where the last attempt stopped.

### 10.8 What A0.4′ actually took, and three more defects it surfaced

The baseline is real now: **35 captures, 33 distinct images, smallest 85KB.** (Compare the committed
set it replaced: 35 files, 8 distinct, all 19KB.) The two remaining duplicate pairs are legitimate
route aliases — `/dashboard` = `/dashboard/admin`, `/manufacturing` = `/manufacturing/batches` — so
do not "fix" them.

Capturing it surfaced three defects beyond the error-page P0. All three are now fixed, and all three
were invisible until someone actually ran the thing and looked at the output.

**1. Blank captures pass every guard.** `/accounting` and `/dashboard/production` first captured as
4.8KB white pages showing nothing but the top loading bar. `wait --networkidle` returns while a
client-side route is still resolving, and the 600ms settle was not enough. Neither the preflight nor
the degenerate-hash check catches this — two blank pages are _distinct from each other_. A blank
baseline is more dangerous than an error page precisely because it looks plausible in review. Fixed
with a content assertion in the settle script: poll up to 8s for `body.innerText` past 200 chars,
then report `CAPTURE_BLANK` and delete the file rather than keep it. That is the **fourth** guard.

**2. `--only` destroyed the whole output directory.** `rmSync(outDir)` was unconditional, so
`--out baseline --only login` deleted the other 34 routes. The browse daemon flakes 4-6 routes per
35-route run (`Server failed to start within 15s`, taskkill races), which made incremental retry the
_only_ practical way to finish a run — and it was the one thing that could not be done. Now the wipe
is skipped whenever `--only` is passed. Full runs still start clean.

**3. `pnpm verify` was red on `main` and on this branch, because of a code comment.**
`scripts/check-no-any.mjs` tested `/\bany\b/` against raw lines, so it matched the English word "any"
in this comment:

```
// refused on any account that has postings.
```

One false positive, in an accounting file, from commit `4a11f4d`. Since A0.3 put `pnpm verify` in
`.githooks/pre-push`, **every frontend push was blocked by prose** — and nobody had discovered it
because nothing has been pushed. Read that against the hook's own header warning: a gate that fires
spuriously gets bypassed with `--no-verify`, and `--no-verify` also disables the Git LFS chaining the
hook exists to preserve. A false positive here does not annoy, it routes people into the exact
failure A0.3 was written to prevent.

Fixed by blanking comments and string literals before the test, preserving newlines so line numbers
still resolve. Verified both ways: it still catches a real `const x: any`, and it passes the tree.
`pnpm verify` now exits 0.

**Worth deciding (TODOS T-E):** `eslint.config.mjs` enables `tseslint.configs.strictTypeChecked`,
which already carries `@typescript-eslint/no-explicit-any` at `error`, AST-aware. Lint reports 0
errors, so the tree is genuinely `any`-free and this script is pure redundancy. Deleting it is
defensible; it was kept because deleting someone's check is an owner call, not a review call.

### 10.10 E5 is half-shippable, and the other half has no host

**Offline: shipped.** Charge disables with the reason in its own label, a persistent
undismissable bar sits in the counter layout, and reachability is inferred from real
traffic rather than a probe. Two corrections to what the plan assumed:

- **"25 files already reference `onLine`/`offline` ad hoc" was false.** The real
  count was zero — `grep -rli offline src/` returned nothing. E5's offline half was
  greenfield, not a consolidation.
- **`navigator.onLine` alone would have missed the target case.** It reports true
  whenever any interface is up, so the bakery failure — access point alive, router
  or uplink dead — reads as online while every charge fails. Reachability is now a
  second, independent signal driven by network-class request failures.

**Partial: not built, deliberately.** The plan specifies "a list that loaded page 1
of N and failed on page 2". That state **cannot occur in this codebase**:

```
useInfiniteQuery / fetchNextPage / hasNextPage   0 occurrences
client-side pagination (getPaginationRowModel)   0 occurrences
```

Every list fetches once, whole. Building the strip would produce a primitive with
zero call sites, which is precisely the C0.5 mistake — and this time it would be
made knowingly. It is deferred until incremental loading exists, and it should be
built _with_ that work rather than before it.

**But a real cousin exists and nothing surfaces it.** Three call sites hard-cap at
`?limit=100` — `getManufacturingProducts`, the purchasing ingredient options, and
the manufacturing inventory options. A tenant with 150 products sees 100 in those
pickers with **no error, no notice, and no way to tell**. That is a silent
truncation, which is worse than a failed page 2 because there is nothing to react
to.

It cannot be fixed in the presentation layer alone: those endpoints return a bare
array with no `total`, so the frontend genuinely cannot distinguish "100 of 100"
from "100 of 150". Two options, and this needs an owner decision rather than a
guess:

- **Return a total** (backend contract change, outside E5's stated boundary) and
  render an accurate "Showing 100 of 150 — refine your search".
- **Heuristic**: when exactly `limit` rows come back, warn "Showing the first 100".
  No contract change, but it cries wolf on a tenant with exactly 100.

Recorded as a TODO rather than folded into E5, because the honest fix is a contract
change and E5 is presentation-only.

### 10.9 Shipped in this session — the Counter register is token-native

Not review findings; work done. `pnpm verify` exits 0, lint holds at **0 errors**, repo warnings fell
**1551 → 1271**.

**`components/pos` drift: 355 → 0.** Zero raw palette utilities, zero hex in `className`, zero bare
`bg-white`/`bg-black`/`text-white`, zero `font-black` (was 28 across 11 files). That is B1 + B2 + B4
finished for the directory §3 names as the worst offender, using MIGRATION.md's corrected mappings —
with one deliberate deviation from Phase 3: `zinc-400`/`neutral-400` map to `text-foreground-muted`,
**not** `text-foreground-disabled`, because as content the disabled token is ~3.1:1 and Phase 3's row
would have codemodded a contrast failure into 100+ places.

**§9.1 is closed, and verified at runtime rather than asserted.**
`components/density/density-provider.tsx` supplies the register; `dialog`, `sheet`, `select`,
`popover` and `dropdown-menu` each stamp `data-density` onto their portalled content. Measured in a
browser:

```
/pos       dialog → density=counter  controlH=3rem     tapMin=3rem    (48px)
/dashboard body   → ledger           controlH=2.25rem  tapMin=2rem    (36px / 32px)
```

The six POS dialogs, `pos-checkout-dialog` included, now render 48px controls — and the register
stays scoped instead of becoming a global change.

**Design decisions, each traceable to a principle:**

| Change                                                    | Principle                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Exit POS` demoted to outline; `Charge` is the only green | §3.2 — the one saturated thing is the one that moves money. A filled Exit POS was the loudest control on a till.                                              |
| Charge label carries the amount (`Charge AED 75.60`)      | The cashier confirms a figure against the receipt, not a word.                                                                                                |
| Total payable → 32px mono tabular, weight 500             | §2 `text-total`. Was 18px at weight 900 among five other `font-black` elements; size carries a total, not weight.                                             |
| VAT → segmented control (muted track, raised thumb)       | §6. Selected-black-plus-outlines made a mode _indicator_ read as competing primaries.                                                                         |
| Out-of-stock badge moved into the content row             | **Closes T-L.** It was `absolute left-3 top-3` against a 48px Variants button at `right-3 top-3`, colliding on a 146px tile. Structural, not an offset nudge. |
| Variants button → card fill + border, keeps 48px          | It was a solid black fill reading as the tile's primary action — the thing A0.1 was opened over.                                                              |
| Tile hover → 1px lift + `--shadow-sm`                     | §5. A darkening border reads as a state change; a lift reads as pressable.                                                                                    |
| Clock gets `tabular-nums`                                 | It ticks every second; without it the header reflowed on digit-width changes.                                                                                 |
| POS toolbar wraps to two rows below 2xl                   | `md:grid-cols-4` gave text inputs button-width (~95px in a 400px column), so both clipped their own placeholders to "Searc" and "Barco".                      |
| Empty cart `min-h-64` → `h-full`, copy to AA              | The fixed 256px slab clipped behind the VAT divider once the total grew, and `text-zinc-400` at ~2.8:1 read as disabled when nothing is disabled.             |

**A lint rule was wrong and is fixed.** `design/no-disabled-as-content` rejected
`disabled:text-foreground-disabled` — the exact usage its own message calls permitted — so at `error`
severity no disabled control could be styled. Now carries a negative lookbehind for
`disabled:`/`placeholder:` variants, verified to still catch bare content usage.

**Honest gap:** the `CAPTURE_BLANK` guard's _detection_ half is unproven. The content-wait poll fixed
the blank captures by waiting them out, so the marker branch never fired. `js` return values do
surface from browse (verified separately), so the mechanism is sound — but that branch has not run
against a real blank page.

### 10.5 What this pass did not do

Aesthetic dimensions were left alone, by agreement at the start of the run. The token system, type
scale, register split and colour semantics are settled in DESIGN.md v3 and were not re-litigated.
§9's structural calls — the density provider, the static tap-target assertion, the DESIGN.md sections
routed to B6 — were accepted as-is and not re-derived. §9.8 (Track D's position) is still open and
still needs the owner; nothing found here changes its argument.

### 10.6 Unresolved after this pass

| Decision                                                               | If deferred                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §9.8 Track D's position — still open from the first pass               | D2/D3/D5 keep ~3.5d at the front of a capacity-bound schedule, or the landing page stays ugly for weeks. Owner's call; the morale argument is real and unpriceable. |
| Whether A0.4′ blocks Track B or runs beside it                         | Recommended: blocks. Left open, 1,900 utilities of codemod land with no visual safety net at all.                                                                   |
| Whether `frontend-design-system.md` is deleted or reduced to a pointer | Recommended: pointer, so the URL keeps working. Left open, it stays the fourth contract.                                                                            |

---

## GSTACK REVIEW REPORT

| Run | Skill                                        | Status           | Findings                                                                                                                                |
| --- | -------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/plan-design-review` (2026-08-17, pre-A0)   | absorbed         | §9 — density portals, 6 uncovered states, jsdom assertion, dropped DESIGN.md sections, cashier journey, `pnpm verify` gap               |
| 2   | `/plan-design-review` (2026-08-17, post-A1′) | **issues found** | §10 — 1 P0 (baselines are error pages), 1 high (fourth design doc), 1 medium (§9.5 unfixed), 6 state designs added, 2 scope corrections |

**Design completeness: 7/10 → 9/10.** Held back from 10 by two things outside this skill's reach:
§9.8 needs an owner decision, and A0.4′ needs to actually run before DoD #5 is true.

**Outside voices:** not run. `codex` is on PATH, but the OpenAI key the design binary needs is
absent (`design setup`), and the same key gates the Codex path in this environment. Single-model
review — treat §10 as one reviewer's findings, with the P0 backed by a reproducible command rather
than by judgement.

**Mockups:** generated as hand-authored HTML at real token values
(`docs/design/preview-states.html`), not via the AI designer, which is unavailable for the same
key reason. For a system already specified to measured-contrast precision this is the better
artifact — it cannot invent a colour outside the token set.

**VERDICT: the plan is sound and its verification layer is not.** §9 fixed the design gaps; this
pass found that three of the mechanisms meant to prove the work are decorative — baselines that are
error screenshots, a `verify` script that skips the tests, and a visual gate with no true reference.
Fix A0.4′ and §10.2 before Track B. The six state designs are ready to build against.

**UNRESOLVED DECISIONS:**

- §9.8 — Track D's position (D2/D3/D5 before or after Track E). Carried over unanswered from the first pass.
- A0.4′ — hard-blocks Track B, or runs alongside it. Recommended: blocks.
- `frontend/docs/frontend-design-system.md` — delete outright, or reduce to a pointer at DESIGN.md. Recommended: pointer.
