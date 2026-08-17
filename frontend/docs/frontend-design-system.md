# Frontend component selection guide

> **This is NOT the design contract.** [DESIGN.md](../../DESIGN.md) is, and it wins on tokens,
> colour, type, spacing, motion and component rules — see CLAUDE.md's document-precedence rule.
> This file is narrower: **which component to reach for**, not what it should look like.
>
> Its "Brand Tokens" section was deleted on 2026-08-17. It specified a Creamy Latte `#F3E9D7` page
> background, Caramel Roast `#B08968` primary actions and Caramel Roast focus rings — all three
> reversed by DESIGN.md v3, which is monochrome by default with green reserved for money and focus
> rings blue and only blue. Worse, it named the exact browns MIGRATION.md identifies as the root
> cause of the 298 hardcoded hexes: developers reached for a colour the token layer did not have,
> because this file told them to.
>
> **For any colour, size, weight, radius, shadow or motion question, read DESIGN.md.** If this file
> and DESIGN.md ever disagree again, DESIGN.md is right and this file is a bug.

## Goals

- Build one consistent interface system across POS, inventory, purchasing, accounting, manufacturing and reporting workflows.
- Use `shadcn/ui` as the core operational component system.
- Keep POS and back-office workflows fast, accessible, responsive, and predictable.
- Take every visual value from the DESIGN.md token layer. Never introduce a colour here.

## Colour, type, spacing

Deleted. See [DESIGN.md](../../DESIGN.md) §2 (type), §3 (colour), §4 (spacing, radius, elevation),
§5 (motion). The token layer lives in `docs/design/tokens.css`; `docs/design/preview-v3.html` and
`docs/design/preview-states.html` are the visual references.

## shadcn/ui Usage Strategy

Use `shadcn/ui` for all core product UI.

Navigation:

- `Sidebar`: main dashboard navigation when installed.
- `Navigation Menu`: public website or future admin top navigation.
- `Breadcrumb`: dashboard page hierarchy.
- `Menubar`: advanced desktop admin menus only.
- `Sheet`: mobile sidebar and POS cart drawer.
- `Drawer`: mobile bottom panels once installed.
- `Dropdown Menu`: user menus and row actions.
- `Context Menu`: future right-click table actions.
- `Command`: global command palette.
- `Combobox`: searchable selects for suppliers, customers, products, branches, and users.

Forms:

- `Input`: text fields.
- `Textarea`: notes and descriptions once installed.
- `Select`: standard dropdowns.
- Native `select`: only for lightweight low-value selects.
- `Combobox`: searchable selection.
- `Checkbox`: permissions and multi-select options.
- `Radio Group`: payment type and exclusive status choices once installed.
- `Switch`: enable/disable toggles once installed.
- `Slider`: future discount/range filters once installed.
- `Input OTP`: verification/security screens once installed.
- `Field`: reusable form field wrapper once installed.
- `Label`: all accessible labels.
- `Date Picker` and `Calendar`: order, invoice, delivery, expiry, and reconciliation dates once installed.

Feedback:

- `Alert`: inline warnings and notices.
- `Alert Dialog`: destructive confirmations once installed. Until then, use `AppConfirmDialog` backed by `Dialog`. **`AppConfirmDialog` exists and has zero call sites** — every destructive action in the app still fires immediately or confirms through ad-hoc markup. Wiring it up is plan item C0.6; the design it must implement is in `docs/design/preview-states.html`.
- `Sonner`: success/error notifications.
- `Progress`: setup/upload/stock progress once installed.
- `Spinner`: button loading states once installed.
- `Skeleton`: loading tables/cards.
- `Empty`: no-data states once installed. Until then, use `AppEmptyState`.

Data display:

- `Table`: simple tables.
- `Data Table`: products, users, inventory, payments, suppliers, and purchasing once installed.
- `Badge`: status labels.
- `Card`: dashboard cards and forms.
- `Avatar`: users, customers, staff.
- `Item`: compact list rows once installed.
- `Typography`: standard headings/text once installed.
- `Separator`: section division.
- `Hover Card`: quick previews once installed.
- `Tooltip`: helper explanations.
- `Pagination`: table pagination once installed.
- `Chart`: reports and summaries once installed.

Layout:

- `Accordion`: grouped settings and permission groups once installed.
- `Collapsible`: filter panels and sidebar groups once installed.
- `Tabs`: settings, product details, customer details, supplier details.
- `Scroll Area`: POS cart and long side panels once installed.
- `Resizable`: advanced admin layouts only.
- `Aspect Ratio`: product images once installed.
- `Carousel`: marketing and landing visuals only.

Interactive:

- `Button`, `Button Group`, `Toggle`, `Toggle Group`, `Popover`, `Dialog`, `Sheet`, and `Drawer` should be used through app wrappers when available.

Special:

- `Kbd`: POS shortcuts once installed.
- `Direction`: RTL/LTR localization support later.

## App-Level Wrappers

Raw `shadcn/ui` primitives should stay available, but new product modules should prefer `src/components/app/*` wrappers when they match the use case.

Wrappers created:

- `AppButton`
- `AppCard`
- `AppTable`
- `AppDialog`
- `AppSheet`
- `AppInput`
- `AppSelect`
- `AppBadge`
- `AppEmptyState`
- `AppPageHeader`
- `AppSectionCard`
- `AppConfirmDialog`
- `AppDataTable`

Wrapper responsibilities:

- Apply the DESIGN.md token layer. Never a literal colour, never a raw Tailwind palette utility — both are lint errors as the guardrails flip.
- Consume the density variables (`h-control`, `h-field`, `h-row`, `min-h-tap`) rather than literal heights, so a wrapper works in both the Counter and Ledger registers.
- Keep spacing consistent.
- Preserve accessibility behavior from the underlying shadcn primitive.
- Provide variants for admin, POS, danger, success, warning, and muted states where relevant.
- Avoid business logic. Wrappers are presentation contracts only.

## Module Strategy

Auth:

- Use `Card`, `Input`, `Label`, `Button`, `Alert`, `Sonner`, typography, and light `magicui` page entry/background effects.

Dashboard:

- Use `Card`, `Chart`, `Badge`, `Skeleton`, `Empty`, `Breadcrumb`.
- Use `magicui` `Number Ticker` for KPIs and `Bento Grid` for dashboard overview.

Users and Roles:

- Use data tables, dialogs, confirmation dialogs, checkboxes, switches, badges, dropdown menus, tooltips, tabs, and accordions for permission groups.

Settings and Master Data:

- Use cards, tabs, accordions, dialogs, selects, switches, badges, empty states, tooltips, and breadcrumbs.

Products:

- Use data tables, dialogs, drawer/sheet details, aspect-ratio images, badges, selects, comboboxes, switches, tabs, and destructive confirmations.

POS Billing:

- Use a custom POS layout.
- Use buttons, button groups, sheets, drawers, scroll areas, badges, dialogs, confirmations, keyboard shortcut labels, tooltips, Sonner, and skeletons.
- Do not use heavy magicui animation in POS.

Inventory:

- Use data tables, badges, progress, charts, alerts, dialogs, drawers, tabs, and tooltips.

Stock Movements:

- Use data tables, badges, drawers, dialogs, confirmations, charts, timeline-style custom components, and tooltips.

Suppliers:

- Use data tables, dialogs, cards, badges, tabs, drawers, and tooltips.

Purchasing:

- Use data tables, dialogs, comboboxes, date pickers, cards, tabs, accordions, confirmation dialogs, sheets, and badges.

Reports:

- Use charts, cards, tabs, date pickers, selects, data tables, `magicui` Number Ticker, and Bento Grid.

## magicui Usage Strategy

Use `magicui` only where polish improves comprehension or conversion.

Allowed areas — **narrowed 2026-08-17 to match DESIGN.md §5:**

- Landing page.
- Marketing pages.
- Subscription page.

Removed, and why:

- **Dashboard KPI animation / Number Ticker.** DESIGN.md §5: _never animate a number changing._ A KPI
  that counts up is unreadable while it moves, and on a financial dashboard it invites the reader to
  mistrust the figure.
- **Empty states.** They now have a specified design (E1, `docs/design/preview-states.html`) built on
  a primary action, not decoration. An animated or illustrated empty state delays the one control
  that matters.
- **Auth/onboarding, setup completion, welcome screens.** These are the Threshold register
  (DESIGN.md §7), whose treatment is a serif wordmark and generous space. The blurred drifting
  gradient orbs currently on `/login` came from this permission and are being deleted (plan D1).

Preferred components:

- Magic Card.
- Bento Grid.
- Number Ticker.
- Blur Fade.
- Border Beam.
- Animated List.
- Shimmer Button for special CTA only.
- Shine Border.
- Confetti.
- Theme Toggler.
- Grid Pattern and Dot Pattern.
- Text Animate or Typing Animation for onboarding hero copy.

Avoid in operational screens:

- Sparkles Text overuse.
- Cool Mode.
- Heavy particles.
- Smooth Cursor.
- Large animated backgrounds.
- Excessive motion in POS.

Reason: operational users need speed and clarity more than decoration.

## Installation Plan

Batch 1 - Foundation:

- Button, Input, Label, Card, Form, Dialog, Alert, Sonner, Skeleton, Badge.

Batch 2 - Dashboard Shell:

- Sidebar, Breadcrumb, Dropdown Menu, Sheet, Avatar, Separator, Tooltip.

Batch 3 - Data Management:

- Table, Data Table, Pagination, Select, Combobox, Checkbox, Switch, Alert Dialog, Tabs.

Batch 4 - Advanced Forms:

- Date Picker, Calendar, Popover, Textarea, Radio Group, Accordion, Collapsible, Scroll Area.

Batch 5 - Operational UX:

- Drawer, Button Group, Toggle, Toggle Group, Progress, Kbd, Empty, Chart.

Batch 6 - Optional:

- Carousel, Context Menu, Hover Card, Resizable, Menubar, Navigation Menu, Input OTP.

MagicUI batch:

- Magic Card, Bento Grid, Number Ticker, Blur Fade, Border Beam, Animated List, Shine Border, Confetti, Theme Toggler, Grid Pattern, Dot Pattern.

## Accessibility Rules

- WCAG 2.1 AA is the target.
- Every input needs a visible or screen-reader label.
- Dialogs/sheets need a title, even if visually hidden.
- Icon-only buttons need `aria-label`.
- Focus states must be visible.
- Do not rely on color alone for status.
- Motion must respect `prefers-reduced-motion`.
- Tables need clear headers and action labels.
- Destructive actions require confirmation.

## Motion Rules

- Use subtle page entry animation only outside high-frequency operational flows.
- Do not animate POS cart, product grid, quantity changes, or checkout controls in a way that delays input.
- Dashboard number animation is acceptable if it does not block content.
- Empty-state animation should be decorative and optional.

## Developer Guidelines

- Prefer app wrappers for new modules.
- Use raw `shadcn/ui` only when a wrapper does not exist or the wrapper would hide necessary behavior.
- Do not add a component because it looks interesting. Add it because it solves a specific UX problem.
- Keep business logic in hooks/API modules, not visual components.
- Keep module-specific components small and composable.
- Run `pnpm verify` after UI foundation changes. It chains typecheck, lint, `check:no-any`, `check:tokens`, `format:check` and the tests.
