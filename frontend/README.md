# Pastries POS Frontend

Frontend foundation for the Pastries POS SaaS platform.

This repository uses:

- Next.js App Router
- TypeScript strict mode
- pnpm
- Tailwind CSS
- shadcn/ui style component structure
- Appwrite Web SDK
- TanStack Query
- React Hook Form
- Zod
- lucide-react
- ESLint
- Prettier
- Husky
- lint-staged

## Current Stage

Current implementation date: May 12, 2026

Documentation policy:

- Update this README after each completed phase or meaningful frontend behavior change.
- Keep both phase status and recent implementation notes in sync with the codebase.
- Follow `docs/frontend-design-system.md` for component selection, shadcn/ui usage, magicui usage, motion rules, and app wrapper guidance.

Deployment environment policy:

- Local development uses `.env` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`.
- `.env.local.example` documents local defaults.
- `.env.production.example` documents Dokploy/production values.
- Production must not use `localhost`; set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend domain.
- Rebuild/redeploy after changing any `NEXT_PUBLIC_*` value because Next.js bakes public env values into the build.

Phase status:

- Phase 1: Auth frontend
  - Status: completed
- Phase 2: Protected dashboard shell
  - Status: completed
- Phase 3: Dashboard page foundation
  - Status: replaced by Sprint 5.7 role-based dashboard intelligence
- Phase 4: User Management UI
  - Status: completed
- Phase 5: Roles & Permissions UI
  - Status: completed against the current backend role and permission APIs
- Phase 6: Settings
  - Status: connected to Phase 2.7 settings/master-data APIs, company/tax/payment settings, and receipt layout management APIs
- Admin/Auth hardening pass
  - Status: completed as frontend foundation; backend-dependent flows remain documented below
- Backend admin contracts
  - Status: documented for invites, branches, soft-delete, and activity logs
- POS module foundation
  - Status: completed as permission-aware frontend shell; live billing APIs are not built yet
- Sprint 2.1: Products module foundation
  - Status: completed and connected to products + variants + reference-data APIs
- Sprint 2.2: POS Billing module foundation
  - Status: completed as a dedicated fullscreen POS workspace connected to POS products, lookup, checkout, payment methods, and product categories APIs
- Sprint 2.3: Payments module foundation
  - Status: finalized and connected to payment tracking, refund, summary, by-method summary, and reconciliation APIs
- Sprint 2.4: Customers module foundation
  - Status: finalized and connected to customer CRUD, lookup, quick-create, tags, tag assignment, notes, and stats APIs
- Sprint 3.1: Inventory module foundation
  - Status: completed and connected to inventory, movements, low-stock, expiry-alert, and expiry-batch APIs
- Sprint 3.2: Stock Movements module
  - Status: completed and connected to stock movement ledger, manual movement, reversal, summary, detail, and audit APIs
- Sprint 3.3: Suppliers module
  - Status: completed and connected to supplier CRUD, status, lookup, contacts, notes, stats, and supplier category APIs
- Sprint 3.4: Purchasing module
  - Status: completed and connected to purchasing summary, purchase orders, purchase invoices, receiving, and purchase receipts APIs
- Sprint 4.1: Packaging module
  - Status: completed and connected to packaging catalog, lookup, status, usage rules, packaging categories, supplier lookup, and unit APIs
- Sprint 4.2: Recipes BOM module
  - Status: completed and connected to recipes, BOM ingredient lines, BOM packaging lines, cost, cost recalculation, versions, recipe lookup, products, inventory, packaging, and units APIs
- Sprint 4.3: Manufacturing module
  - Status: completed and connected to production batches, lifecycle actions, ingredient consumption, outputs, wastage, batch details, summary, products, recipes, inventory, units, and branches APIs
- Sprint 5.1: Reports foundation
  - Status: completed and connected to dashboard summary, sales/payment/order chart data, branch-safe filters, and CSV export APIs
- Sprint 5.2: Sales Reports module
  - Status: completed and connected to sales summary, daily sales, trend, product, category, cashier, branch, discount, tax, top-products, and slow-moving-products report APIs
- Sprint 5.3: Inventory Reports module
  - Status: completed and connected to inventory summary, current stock, valuation, low-stock, expiry, movement, wastage, packaging stock, audit, and trend report APIs
- Sprint 5.4: Manufacturing Reports module
  - Status: completed and connected to manufacturing summary, production batches, ingredient consumption, yield variance, wastage, recipe costs, and trend report APIs
- Sprint 5.5: Bakery Orders Reports module
  - Status: completed and connected to bakery order summary, upcoming orders, status, production schedule, pending payments, delivery-vs-pickup, and trend report APIs
- Sprint 5.6: Financial / Payment Reports module
  - Status: completed and connected to financial summary, payments, payment method, refunds, outstanding balances, supplier payables, purchase totals, reconciliation, and trend report APIs
- Sprint 5.7: Dashboard Intelligence module
  - Status: completed and connected to role-based admin, cashier, production, purchasing, KPI summary, alerts, and recent activity dashboard APIs
- Frontend Design System Foundation
  - Status: documented with app-level wrapper components added under `src/components/app`

## Completed Work

### Foundation

- Fresh Next.js App Router scaffold inside `frondend`
- Strict TypeScript configuration with `noImplicitAny`
- Tailwind brand tokens and warm bakery theme
- Personal theme preference support with localStorage-backed Latte and Pistachio Fresh themes
- shadcn-compatible `components.json`
- Frontend design system strategy in `docs/frontend-design-system.md`
- App-level component wrapper foundation in `src/components/app`
- Public foundation screen redesigned as a Magic UI-inspired story-driven product page:
  - ultra-premium cinematic hero, floating glass navigation, and stronger commercial product positioning
  - architecture-style ecosystem map for POS, products, payments, customers, inventory, purchasing, suppliers, recipes, packaging, manufacturing, bakery orders, and branch control
  - elevated backend trust model panel explaining validation, permissions, branch isolation, stock, totals, and status ownership
  - interactive mouse-tracked parallax layers and subtle hero hover motion
  - scroll-triggered section reveal transitions using a lightweight IntersectionObserver component
  - stable sans-serif hero headline treatment to avoid large serif hover layout shifts
  - foundation page typography now stays in the latte text family on dark surfaces for consistent premium contrast
  - narrative sections for purpose, build sequence, current foundation, and roadmap
  - premium glass/gradient panels aligned with the auth visual direction
- Centralized typed API client with validation and error handling
- Centralized frontend branch scope handling:
  - `src/hooks/use-branch-scope.ts` derives the effective branch from `/api/v1/auth/me` as `currentBranchId ?? assignedBranchId`
  - `src/hooks/use-branch-scope.ts` also exposes `useBranchQueryKey()` so branch-owned TanStack Query caches are separated by backend `current_branch_id`
  - normal branch users default operational filters to their effective branch instead of `all`
  - `all` branch filtering is only shown/used when `canAccessAllBranches` is true
  - operational screens show a clear no-branch assignment state when a non-all-branch user has no active branch context
  - POS no longer falls back to a random active branch and uses the effective branch for stock lookup
  - POS waits for a valid branch scope before loading products, categories, payment reference data, and inventory stock context
  - POS branch labels prefer `/auth/me` branch names, use branch detail only when the user can load branch metadata, and show `Branch name unavailable` as a degraded state when backend sends only a branch ID
  - POS category navigation falls back to categories derived from visible POS products if master-data category access is unavailable
  - POS category fallback now derives from an unfiltered branch POS product source, so selecting a category only filters products and does not hide the remaining category buttons
  - staff management resets to the currently switched branch so owners/admins immediately see branch-scoped staff
- Backend branch ownership contract alignment:
  - `/api/v1/auth/me.current_branch_id` is treated as the active branch context for branch-owned data
  - login, session restore, and auth profile refresh repair missing active branch context by switching to `assigned_branch_id` when a user has an assigned branch but no `current_branch_id`
  - `POST /api/v1/auth/switch-branch` refreshes the auth profile and invalidates cached page data so the UI does not show previous-branch records
  - branch-owned query keys include the active branch for products, categories, customers, suppliers, ingredients, packaging, recipes, POS held sales/products, inventory, stock movements, purchasing, manufacturing, bakery orders, payments, refunds, and reconciliations
  - business-level data remains branch-neutral in frontend caching: users, roles, permissions, branches, settings, units, tax rates, payment methods, and activity logs
  - create flows should rely on backend `current_branch_id` by default unless an owner/admin flow explicitly supports branch selection and has switched branch context first
- ESLint, Prettier, Husky pre-commit, and `check:no-any`

### Auth

- Appwrite auth helpers for login, verification, logout, JWT creation, and session restore
- Login page redesigned with a Magic UI-inspired premium auth shell:
  - ultra-premium dark command-center background aligned with the new public Foundation page
  - floating glass navigation, operational signal cards, workspace graph panel, animated glow orbs, scanline, and static premium glow login frame
  - refined login card with stronger glass depth, latte CTA, secure-session context, and responsive compact mobile layout
  - existing Appwrite login/session recovery behavior preserved
- Signup form now matches the premium auth visual system with dark glass inputs, field icons, and a stronger owner-account CTA.
- Shared input primitive suppresses hydration warnings for browser/extension-injected input attributes such as `fdprocessedid`.
- Backend password reset integration through `/api/v1/auth/password-reset/request` and `/api/v1/auth/password-reset/complete`
- Backend logout audit sync through `/api/v1/auth/logout-sync`
- Auth provider with in-memory user state
- Auth routes:
  - `/accept-invitation`
  - `/signup`
  - `/login`
  - `/forgot-password`
  - `/reset-password`
  - `/verify-email`
- Frontend-to-backend auth contract mapping:
  - `register-owner` request mapped to backend snake_case
- `login-sync` request sends generated Appwrite JWT in JSON body
- `/auth/me` response parsed from backend snake_case fields
- subscription status parsed from backend auth profile and displayed on the dashboard

### Dashboard Shell

- Protected dashboard shell with:
  - shadcn Sheet hamburger sidebar on all screen sizes
  - header
  - breadcrumb
  - user dropdown
  - logout action
  - permission-aware internal navigation
- Protected internal pages:
  - `/dashboard`
  - `/dashboard/admin`
  - `/dashboard/cashier`
  - `/dashboard/production`
  - `/dashboard/purchasing`
  - `/pos`
  - `/reports`
  - `/reports/dashboard`
  - `/reports/export`
  - `/reports/sales`
  - `/reports/sales/products`
  - `/reports/sales/categories`
  - `/reports/sales/cashiers`
  - `/reports/sales/branches`
  - `/reports/sales/discounts`
  - `/reports/sales/taxes`
  - `/reports/inventory`
  - `/reports/inventory/current-stock`
  - `/reports/inventory/valuation`
  - `/reports/inventory/low-stock`
  - `/reports/inventory/expiry`
  - `/reports/inventory/movements`
  - `/reports/inventory/wastage`
  - `/reports/inventory/packaging`
  - `/reports/inventory/audit`
  - `/reports/manufacturing`
  - `/reports/manufacturing/batches`
  - `/reports/manufacturing/ingredient-consumption`
  - `/reports/manufacturing/yield-variance`
  - `/reports/manufacturing/wastage`
  - `/reports/manufacturing/recipe-costs`
  - `/reports/bakery-orders`
  - `/reports/bakery-orders/upcoming`
  - `/reports/bakery-orders/status`
  - `/reports/bakery-orders/production-schedule`
  - `/reports/bakery-orders/pending-payments`
  - `/reports/bakery-orders/delivery-vs-pickup`
  - `/reports/financial`
  - `/reports/financial/payments`
  - `/reports/financial/refunds`
  - `/reports/financial/outstanding-balances`
  - `/reports/financial/supplier-payables`
  - `/reports/financial/reconciliation`
  - `/users`
  - `/roles`
  - `/suppliers`
  - `/purchasing`
  - `/packaging`
  - `/recipes`
  - `/manufacturing`
  - `/settings`
- Shared state placeholders for loading, empty, error, and access-denied screens

### Phase 4: Users Management UI

- `/users` page delivered
- Typed users API client:
  - `getUsers`
  - `createUser`
  - `getUserById`
  - `updateUser`
  - `updateUserStatus`
- TanStack Query hooks:
  - `useUsers`
  - `useUser`
  - `useCreateUser`
  - `useUpdateUser`
  - `useUpdateUserStatus`
- Users filter row:
  - search input
  - status dropdown
  - branch dropdown for owner/admin/all-branch users
- Users table:
  - staff member cell with avatar fallback
  - email
  - phone
  - role
  - status
  - email verified
  - last login
  - created at
  - actions
- Add/Edit user dialog using:
  - shadcn dialog
  - React Hook Form
  - Zod validation
  - branch assignment dropdown backed by active branches
- Invitation onboarding UI:
  - Invite User dialog backed by `POST /api/v1/users/invitations`
  - Pending invitations panel backed by `GET /api/v1/users/invitations?status=pending`
  - Resend action backed by `POST /api/v1/users/invitations/:id/resend`
  - Cancel action backed by `PATCH /api/v1/users/invitations/:id/cancel`
  - Public `/accept-invitation` activation page backed by `POST /api/v1/auth/accept-invitation`
- Status action flow:
  - activate
  - deactivate
  - suspend
  - confirmation dialog
- Staff user delete flow:
  - separate `Delete user` action backed by the existing soft-delete API
  - delete has its own confirmation dialog and does not replace deactivate
  - delete is gated by `users.delete` and disabled for the currently signed-in user
- Staff branch selects now render a fallback `Selected branch` option when the selected branch ID is known but branch metadata has not loaded, preventing blank branch dropdown triggers.
- Loading, empty, error, and permission-denied states
- Responsive table behavior with horizontal scrolling on smaller screens
- Staff list now shows each user's assigned branch so branch-scoped access is visible from Staff Management.
- Owner/admin-style users can filter Staff Management by assigned branch; normal branch staff remain scoped by backend `current_branch_id`.
- Owner/admin all-branch users now stay on `All branches` by default in Staff Management, so branchless staff users remain visible after creation; normal branch users still default to their active branch.
- Staff branch assignment is now guarded in create/invite/edit flows:
  - `No branch assigned` is kept only as an owner/admin setup and recovery state.
  - Cashier and operational staff roles must be assigned to a real active branch before the form can submit.
  - Branchless users are highlighted in the staff table with a `Needs branch setup` badge so admins can find and repair them.
  - Staff branch reassignment now uses the dedicated backend staff-management endpoint `PATCH /api/v1/users/:id/branch` for real branch changes, so Owner/Admin users do not need to switch their active branch before assigning a staff member to another active branch.
  - Staff edit saves still use `PATCH /api/v1/users/:id` for profile, role, phone, status, and branchless owner/admin setup cases; editing the currently logged-in user refreshes `/api/v1/auth/me` after save.
- POS branch display contract:
  - `/api/v1/auth/me` should return `current_branch_name` and `assigned_branch_name` for the authenticated user's own branch context.
  - Staff users should not need `branches.view` just to see their working branch name in POS.
  - The branch switcher is hidden when the signed-in user cannot load branch metadata, preventing broken branch menus that show permission errors or raw branch IDs.
- Redesigned Login page with a Magic UI-inspired premium visual system while preserving Appwrite auth logic, session conflict recovery, and rate-limit recovery.
- Upgraded the frontend TypeScript toolchain to `typescript@6.0.3`, set `ignoreDeprecations` to `6.0`, and added a CSS module declaration required by TS 6 side-effect import checks.
- POS product cards now replace the old `ADD` pill with current/available stock visibility, enriched from inventory when the cashier has stock-view access and falling back to POS product stock fields when provided by the backend.

### Phase 5: Roles & Permissions UI

- `/roles` page delivered
- Typed roles API client:
  - `getRoles`
  - `getRoleById`
  - `createRole`
  - `updateRole`
  - `getRolePermissions`
  - `updateRolePermissions`
- Typed permissions API client:
  - `getPermissions`
- TanStack Query hooks:
  - `useRoles`
  - `useRole`
  - `useCreateRole`
  - `useUpdateRole`
  - `usePermissions`
  - `useRolePermissions`
  - `useUpdateRolePermissions`
- Roles dashboard:
  - stats cards
  - roles table
  - create role dialog
  - edit role dialog
  - permission matrix
  - permission module cards
  - loading, empty, error, and access-denied states
- Role/permission parsing now uses the centralized frontend permission registry so newer modules such as payments, customers, suppliers, purchasing, recipes, manufacturing, and packaging-adjacent flows are not rejected by stale parser lists.
- `GET /api/v1/permissions` supports the new grouped backend response (`[{ module_name, permissions: [...] }]`) and the previous flat response, so existing tenants and freshly migrated tenants both render correctly.
- Permission Matrix now renders modules and granular action permissions directly from `GET /api/v1/permissions`.
- Legacy broad fallback permissions shaped like `module.manage` are filtered out of the matrix. Capability permissions such as `products.variants.manage`, `orders.payments.manage`, and `master_data.units.manage` still render because they represent actual module actions.
- Permission cards show a readable action label with the raw permission key underneath for audit clarity.
- Manage Permissions now uses a table-style matrix for better UX: modules are rows, common actions are columns, advanced module-specific permissions stay visible in a dedicated column, and the save action stays available in a sticky footer.
- Frontend permission gates now use granular permission keys from `/api/v1/auth/me`; old broad `.manage` permissions are not hardcoded in page, button, or sidebar checks.
- Module-level UI gates were audited beyond Products so granular-only users still see the correct entry points and action buttons across Users, Branches, Settings, Master Data, Customers, Suppliers, Ingredients, Packaging, Inventory, Stock Movements, Purchasing, Recipes, Manufacturing, Bakery Orders, Payments, and Audit Logs.
- Reports foundation is connected under `/reports`, `/reports/dashboard`, and `/reports/export`:
  - `GET /api/v1/reports/dashboard/summary`
  - `GET /api/v1/reports/chart/sales`
  - `GET /api/v1/reports/chart/payments`
  - `GET /api/v1/reports/chart/orders`
  - `POST /api/v1/reports/export/csv`
  - report filters include date range, timezone, group by, current/all-branch scope, and branch-safe query keys
  - dashboard charts use Recharts with brand-compatible colors and loading/empty/error states
  - export UI uses React Hook Form and Zod validation before calling the CSV endpoint
  - Owner/Admin all-branch mode sends `branch_id=all` and `scope=all_branches`; normal branch users rely on backend `current_branch_id`
  - CSV export is gated by `reports.export`; dashboard and charts are gated by `reports.view`
- Sales Reports are connected under `/reports/sales`:
  - overview page uses `GET /api/v1/reports/sales/summary`, `/daily`, `/trend`, `/top-products`, and `/slow-moving-products`
  - product, category, cashier, branch, discount, and tax pages use their dedicated `/api/v1/reports/sales/*` endpoints
  - shared sales report filters include date preset, date range, branch scope, group by, timezone, and validation through Zod
  - report tables use typed rows, currency/date formatting, horizontal scroll, empty/error/access-denied states, and Recharts for trend/comparison charts
  - all sales report pages are gated by `reports.view` and keep branch-owned query keys aligned with backend `current_branch_id`
- Inventory Reports are connected under `/reports/inventory`:
  - overview page uses `GET /api/v1/reports/inventory/summary` and `/trend`
  - current stock, stock valuation, low stock, expiry, movements, wastage, packaging stock, and audit pages use their dedicated `/api/v1/reports/inventory/*` endpoints
  - shared inventory report filters include branch scope, item type, status, optional date range, and Zod validation
  - report tables use typed rows, stock/expiry/audit badges, currency/date formatting, horizontal scroll, empty/error/access-denied states, and Recharts for stock-in versus stock-out trend charts
  - all inventory report pages require both `reports.view` and `inventory.view` and keep branch-owned query keys aligned with backend `current_branch_id`
- Manufacturing Reports are connected under `/reports/manufacturing`:
  - overview page uses `GET /api/v1/reports/manufacturing/summary` and `/trend`
  - production batch, ingredient consumption, yield variance, manufacturing wastage, and recipe cost pages use their dedicated `/api/v1/reports/manufacturing/*` endpoints
  - shared manufacturing report filters include date preset, date range, branch scope, product ID, recipe ID, batch status, group by, and Zod validation
  - report tables use typed rows, production status badges, variance indicators, wastage badges, currency/date/quantity formatting, horizontal scroll, empty/error/access-denied states, and Recharts for produced-versus-wastage trend charts
  - all manufacturing report pages require both `reports.view` and `manufacturing.view` and keep branch-owned query keys aligned with backend `current_branch_id`
- Bakery Orders Reports are connected under `/reports/bakery-orders`:
  - overview page uses `GET /api/v1/reports/bakery-orders/summary` and `/trend`
  - upcoming, status, production schedule, pending payments, and delivery-vs-pickup pages use their dedicated `/api/v1/reports/bakery-orders/*` endpoints
  - shared bakery order report filters include date preset, date range, branch scope, customer ID, order type, order status, payment status, group by, and Zod validation
  - report tables use typed rows, order/payment badges, currency/date formatting, horizontal scroll, empty/error/access-denied states, and Recharts for order trend, status, and pickup-versus-delivery charts
  - all bakery order report pages require both `reports.view` and `orders.view` and keep branch-owned query keys aligned with backend `current_branch_id`
- Financial Reports are connected under `/reports/financial`:
  - overview page uses `GET /api/v1/reports/financial/summary` and `/trend`
  - payments, refunds, outstanding balances, supplier payables, and reconciliation pages use their dedicated `/api/v1/reports/financial/*` endpoints
  - payment method performance uses `GET /api/v1/reports/financial/by-payment-method`; purchase totals client support is wired for `GET /api/v1/reports/financial/purchase-totals`
  - shared financial report filters include date preset, date range, branch scope, payment method ID, source type, status, refund status, group by, and Zod validation
  - report tables use typed rows, payment/refund/reconciliation badges, currency/date formatting, horizontal scroll, empty/error/access-denied states, and Recharts for collected/refunded/net trends and payment method charts
  - all financial report pages require `reports.view` and keep branch-owned query keys aligned with backend `current_branch_id`
- Dashboard Intelligence is connected under `/dashboard`:
  - `/dashboard` routes users to admin, cashier, production, or purchasing dashboards based on roles and granted permissions, preferring admin when multiple scopes match
  - role dashboards use `GET /api/v1/dashboard/admin`, `/cashier`, `/production`, and `/purchasing`
  - shared operational panels use `GET /api/v1/dashboard/alerts`, `/recent-activity`, and `/kpi-summary` typed clients
  - dashboard queries include branch-aware query keys, role gates, no-branch blocking, loading skeletons, retryable errors, alerts, activity feed, and quick actions
  - dashboard data refreshes every 60 seconds; alerts refresh every 30 seconds
  - dashboard UI supports `dashboard.view` and temporarily falls back to role-relevant module permissions so existing seeded roles are not locked out while backend tenants receive the new dashboard permission
  - main dashboard CORE now uses a modern intelligence layout with Recharts trend/donut/bar visuals, branch-aware report chart queries, domain metric panels, inventory/production risk charts, and a right-side insight rail for quick actions, alerts, and recent activity
  - cashier, production, and purchasing dashboards were upgraded from KPI-only pages to focused metric panels plus compact workload/risk charts
- Sidebar navigation was refactored into a shadcn-style desktop sidebar plus mobile Sheet:
  - desktop uses a persistent, collapsible sidebar with tooltip labels in collapsed mode
  - mobile keeps the Sheet trigger in the header for small screens
  - POS uses the shared dashboard shell/sidebar for consistent app navigation, while hiding the standard dashboard header and breadcrumb on `/pos`
  - Reports is now a single expandable parent item with indented report submodules for dashboard, sales, inventory, payment, bakery orders, manufacturing, and export center
  - active states, hover states, permissions, and branch-safe routes remain driven by the centralized navigation model
- Sidebar navigation now includes granular view/create/edit permissions so modules stay visible for roles with specific action access.
- Active sessions refresh `/api/v1/auth/me` on tab focus/visibility changes, so newly granted role permissions can take effect without requiring logout. POS reference data also refetches when the current user's permission set changes, which updates payment methods after granting `payments.methods.view`.
- Roles UI access rules now use granular gates:
  - View page: `roles.view` or `roles.permissions.view`.
  - Create role: `roles.create`.
  - Edit role metadata: `roles.edit`.
  - View matrix: `roles.permissions.view` or `roles.view`.
  - Save matrix: `roles.permissions.update`.
- Role management now follows the updated backend default-role rules:
  - Admin remains full-access and permission removal is disabled in the matrix.
  - Cashier, Manager, and Inventory Clerk keep locked names but allow description and permission updates.
  - Custom roles can still be renamed and managed normally.
- Users dialog role selection now prefers the real roles list when the current account can access the roles endpoint.
- If a users-only account cannot access `/api/v1/roles`, the Users dialog falls back to role options derived from the staff list to avoid blocking user management.

### Phase 6: Settings Placeholder UI

- `/settings` page delivered as a protected settings landing page.
- `/settings` now reads backend settings and master-data overview counts.
- Phase 2.7 settings routes added:
  - `/settings/company-profile`
  - `/settings/tax-rates`
  - `/settings/payment-methods`
- Phase 2.7 master-data routes added:
  - `/settings/master-data`
  - `/settings/master-data/units`
  - `/settings/master-data/product-categories`
  - `/settings/master-data/ingredient-categories`
  - `/settings/master-data/packaging-categories`
  - `/settings/master-data/supplier-categories`
  - `/settings/master-data/order-statuses`
  - `/settings/master-data/payment-statuses`
- `/settings/branches` page delivered as the first real settings subsection.
- Settings section data centralized in `src/constants/settings.ts`.
- Settings section types added in `src/types/settings.ts`.
- Permission-aware system settings cards:
  - Company Profile
  - Branch Management
  - Tax Rates
  - Payment Methods
  - Receipt & Invoice Settings
  - Hardware Settings
  - Notifications
  - Subscription & Billing
- Permission-aware Master Data cards:
  - Units & Measurements
  - Product Categories
  - Ingredient Categories
  - Packaging Categories
  - Supplier Categories
  - Order Statuses
  - Payment Statuses
  - Coupon & Loyalty Rules
- Loading, empty, and access-denied states.
- Coming-soon actions show a toast and do not navigate to unbuilt routes.
- Branch Management now navigates to a real branch management page instead of a placeholder toast.
- Receipt & Invoice Settings now navigates to `/settings/receipts`.
- Receipt Layouts are connected to the backend receipt template APIs:
  - `GET /api/v1/settings/receipt-layouts`
  - `POST /api/v1/settings/receipt-layouts`
  - `GET /api/v1/settings/receipt-layouts/:id`
  - `PATCH /api/v1/settings/receipt-layouts/:id`
  - `DELETE /api/v1/settings/receipt-layouts/:id`
  - `PATCH /api/v1/settings/receipt-layouts/:id/default`
  - `POST /api/v1/settings/receipt-layouts/:id/preview`
- Receipt layout UI supports 58mm, 80mm, A4, and custom layout types, optional branch/printer/counter scope, default layout selection, backend preview, field visibility controls, font size, spacing, alignment, footer text, and terms text.
- Receipt layout permissions follow the backend contract:
  - `settings.view` for reading layouts
  - `settings.receipt.update` for create, edit, delete, and default actions

### Branch Management UI

- `/settings/branches` page delivered.
- Connected to backend branch APIs:
  - `GET /api/v1/branches`
  - `POST /api/v1/branches`
  - `GET /api/v1/branches/:id`
  - `PATCH /api/v1/branches/:id`
  - `PATCH /api/v1/branches/:id/status`
- Includes:
  - branch search
  - branch table
  - create branch dialog
  - edit branch dialog
  - manager assignment dropdown filtered to active manager/admin/owner-style users
  - active/inactive status actions
  - loading, empty, error, and access-denied states
- Branch payloads now align with the Phase 2.7 branch contract:
  - frontend sends `branch_name`, `branch_code`, `address`, `manager_user_id`, `phone`, `email`, `timezone`, and `status`
  - frontend does not send `business_id`
  - frontend parses both current backend compatibility fields and the handoff field names
- Permission behavior follows the current backend route guards:
  - `branches.view` to view branches
  - `branches.create`, `branches.edit`, `branches.status.update`, and `branches.access.manage` for branch actions
- Operational branch selection rule:
  - Admin branch management and historical records can still show inactive branches.
  - Create/edit operational flows must use the signed-in user's backend `current_branch_id` for new work.
  - If an old record already belongs to an inactive branch, the current record branch is preserved in the edit form so the form does not lose context.
  - Applied to purchasing orders, purchasing invoices, purchase receiving, manufacturing batch creation, inventory opening stock, bakery orders, and payment reconciliation.
  - To work in another branch, the frontend must call `POST /api/v1/auth/switch-branch`, refresh `/api/v1/auth/me`, and refetch operational data.
  - Frontend branch filtering is UX only; backend branch isolation remains authoritative.

### Sprint 2.2: POS Billing Module

- `/pos` now uses a dedicated fullscreen route group outside the standard dashboard layout.
- Normal dashboard header/sidebar/page container are hidden for POS.
- POS uses a compact top bar with:
  - hamburger menu
  - cashier name
  - active branch label
  - live date/time
  - profile dropdown
  - exit-to-dashboard action
- Sidebar and mobile navigation show POS only for users with `pos.view` or `pos.sell`.
- Added typed POS API client in `src/lib/api/pos.ts`:
  - `GET /api/v1/pos/products`
  - `GET /api/v1/pos/products/lookup`
  - `POST /api/v1/pos/checkout`
  - `GET /api/v1/pos/sales/:id/receipt`
  - `GET /api/v1/settings/payment-methods`
  - `GET /api/v1/master-data/product-categories`
- Added POS hooks:
  - `usePOSProducts`
  - `usePOSReferenceData`
  - `usePOSCart`
  - `usePOSCheckout`
- POS workspace includes:
  - product categories
  - product search
  - barcode lookup
  - POS product grid
  - variant selection dialog
  - active cart panel
  - quantity controls
  - line discount controls inside cart items
  - compact cart totals in the default cart view
  - sale discount and payment method selection inside the checkout payment dialog
  - split payment rows with per-method amount and reference input
  - checkout confirmation dialog
  - receipt dialog with browser print/download actions using the active/default Receipt Layout configuration when available
  - held-sales dialog connected to backend hold/resume/cancel APIs
  - mobile cart drawer
- Keyboard shortcuts:
  - `/` focuses barcode/search entry
  - `Enter` on barcode input runs lookup
  - `F2` opens cart/payment drawer on smaller screens
  - `F4` opens checkout when cart/payment are valid
  - `Ctrl/Cmd + Backspace` clears cart after confirmation
- Checkout totals are calculated frontend-side for UX only; backend checkout remains authoritative.
- POS receipt rendering now selects an active receipt layout in this order: current branch default, branch printer/counter layout, branch active layout, business-wide default, then fixed fallback template.
- POS checkout now sends multiple payment entries when the cashier uses split payments.
- POS held sales are connected:
  - `POST /api/v1/pos/held-sales`
  - `GET /api/v1/pos/held-sales`
  - `GET /api/v1/pos/held-sales/:id`
  - `POST /api/v1/pos/held-sales/:id/resume`
  - `DELETE /api/v1/pos/held-sales/:id`
- Refund UI, full customer CRUD, and inventory deduction remain future POS phases.

### Sprint 2.3: Payments Module

- `/payments` page delivered.
- `/payments/refunds` page delivered.
- `/payments/reconciliations` page delivered.
- Added dedicated Payments navigation entry for users with payment or POS viewing permissions.
- Added payment permissions to the frontend permission model:
  - `payments.view`
  - `payments.add`
  - `payments.refund`
  - `payments.reconcile`
  - `payments.summary.view`
  - `payments.methods.view`
- Added typed payments API client in `src/lib/api/payments.ts`:
  - `GET /api/v1/payments`
  - `GET /api/v1/payments/:id`
  - `GET /api/v1/payments/sale/:saleId`
  - `POST /api/v1/payments/sale/:saleId/add-payment`
  - `POST /api/v1/payments/:paymentId/refund`
  - `GET /api/v1/payments/refunds`
  - `GET /api/v1/payments/refunds/:id`
  - `GET /api/v1/payments/summary/daily`
  - `GET /api/v1/payments/summary/by-method`
  - `POST /api/v1/payments/reconciliations`
  - `GET /api/v1/payments/reconciliations`
  - `GET /api/v1/payments/reconciliations/:id`
  - `GET /api/v1/settings/payment-methods`
- Added TanStack Query hooks in `src/hooks/use-payments.ts`:
  - payments list/detail
  - sale payments
  - add payment to sale
  - refund payment
  - refunds list/detail
  - daily and by-method summaries
  - reconciliations list/detail/create
  - payment methods
- Payments UI includes:
  - daily summary cards
  - collection-by-payment-method summary cards
  - payment filters
  - payments table
  - payment details drawer
  - add payment dialog
  - refund payment dialog with remaining-refundable amount validation
  - refunds table
  - reconciliation table
  - reconciliation creation dialog
  - loading, empty, error, and access-denied states
- Payments finalization updates:
  - disabled refund actions now explain failed, pending, and fully refunded states
  - payment details drawer shows remaining refundable amount and timeline-style refund history
  - add-payment dialog marks payment reference as required when the selected backend payment method requires it
  - refund dialog blocks obvious over-refunds before submit while backend remains authoritative
  - reconciliation rows show balanced, surplus, or shortage status for the backend-calculated difference
  - payment list refreshes summaries, details, refunds, and reconciliation data after add/refund actions
- Permission behavior:
  - `pos.view` or `payments.view` can view payments/refunds
  - `pos.sell` or `payments.add` can add payments
  - `pos.refund` or `payments.refund` can refund payments
  - `reports.view` or `payments.reconcile` can view reconciliations
  - `payments.reconcile` can create reconciliation records

### Sprint 2.4: Customers Module

- `/customers` page delivered.
- `/customers/[id]` profile page delivered.
- Added Customers navigation entry for users with customer permissions, with temporary POS view fallback until all tenants have `customers.*` permissions seeded.
- Added customer permissions to the frontend permission model:
  - `customers.view`
  - `customers.create`
  - `customers.edit`
  - `customers.delete`
  - `customers.status.update`
  - `customers.notes.manage`
  - `customers.tags.manage`
  - `customers.quick_create`
- Added typed customers API client in `src/lib/api/customers.ts`:
  - `GET /api/v1/customers`
  - `POST /api/v1/customers`
  - `GET /api/v1/customers/lookup`
  - `POST /api/v1/customers/quick-create`
  - `GET /api/v1/customers/:id`
  - `PATCH /api/v1/customers/:id`
  - `PATCH /api/v1/customers/:id/status`
  - `DELETE /api/v1/customers/:id`
  - `GET /api/v1/customers/tags`
  - `POST /api/v1/customers/tags`
  - `PATCH /api/v1/customers/tags/:id`
  - `DELETE /api/v1/customers/tags/:id`
  - `GET /api/v1/customers/:id/tags`
  - `POST /api/v1/customers/:id/tags`
  - `DELETE /api/v1/customers/:id/tags/:tagId`
  - `GET /api/v1/customers/:id/notes`
  - `POST /api/v1/customers/:id/notes`
  - `DELETE /api/v1/customers/:id/notes/:noteId`
  - `GET /api/v1/customers/:id/stats`
- Added TanStack Query hooks in `src/hooks/use-customers.ts`:
  - customer list/detail/create/update/status/delete
  - customer lookup and POS quick-create
  - customer tags list/create/update/delete
  - customer tag assignment and removal
  - customer notes list/create/delete
  - customer stats
- Customers UI includes:
  - summary cards
  - filters for search, status, tag, and date range
  - customers table with status badges and row actions
  - add/edit customer dialog with React Hook Form and Zod validation
  - profile page with stats, profile card, notes, tags, and purchase-history placeholder
  - loading, empty, error, and access-denied states
- Customers finalization updates:
  - POS customer lookup is debounced and displays customer code, contact, and status badges
  - inactive/blocked customer records are disabled in the POS selector if returned by the backend
  - quick-create accepts full name with optional phone/email and auto-selects the returned backend customer
  - notes enforce the backend 1000-character maximum and display newest first
  - tags can be created, assigned to a customer, and removed from a customer through dedicated backend assignment APIs
  - stats now display total sales, total paid, total refunded, net spent, total orders, last purchase, and outstanding balance
- POS customer selector now uses backend lookup and quick-create:
  - searches active customers by backend lookup
  - selects customer ID into the POS cart state
  - creates a customer during billing through `/api/v1/customers/quick-create`
  - blocked/inactive customers are not selectable in POS lookup

### Sprint 2.1: Products Module Foundation

- `/products` page delivered.
- Permission-aware products access:
  - `products.view` to view
  - `products.create`, `products.edit`, `products.delete`, `products.status.update`, `products.variants.manage`, and `products.images.manage` for product actions
- Added typed products API client in `src/lib/api/products.ts`:
  - `GET/POST/PATCH/DELETE /api/v1/products`
  - `GET/POST/PATCH/DELETE /api/v1/products/:productId/variants...`
  - product reference data composition from:
    - `GET /api/v1/master-data/product-categories`
    - `GET /api/v1/master-data/units`
    - `GET /api/v1/settings/tax-rates`
- Added TanStack Query hooks in `src/hooks/use-products.ts`:
  - products list/detail/create/update/status/delete
  - variants list/create/update/status/delete
  - reference-data query for product form options
- Added product UI components in `src/components/products`:
  - products page client, toolbar, filters, table, status/type badges
  - add/edit product dialog
  - details drawer with variants section
  - variant add/edit dialog
  - loading, empty, error, and access-denied states

### Admin/Auth Hardening Pass

- Global API `401` session-expiry handling now clears Appwrite session state and redirects to `/login`.
- Business onboarding route added:
  - `/onboarding`
  - connects to backend `GET /api/v1/business/onboarding-status`
  - shows backend completion percent and setup steps
- Account profile route added:
  - `/profile`
  - shows signed-in account, business, roles, email verification, and password recovery actions
- Admin audit logs route added:
  - `/audit-logs`
  - visible from the user menu only for accounts with `audit_logs.view`
  - route-ready placeholder until backend audit APIs exist
- Header user menu now includes:
  - Profile
  - Business onboarding
  - Settings
  - Audit logs for settings managers
  - Branch switching backed by `POST /api/v1/auth/switch-branch`
- Dashboard quick actions now link to real frontend routes.

### Backend Admin Contracts

- Contract document added at `docs/backend-contracts.md`.
- Covered backend contracts:
  - invitation-based staff onboarding
  - branch list/create/update and user branch assignment
  - user soft-delete and restore
  - user/business activity logs
- Frontend contract types added:
  - `src/types/invitation.ts`
  - `src/types/branch.ts`
  - `src/types/activity-log.ts`
- User soft-delete result type added in `src/types/user.ts`.
- Frontend API clients added:
  - `src/lib/api/invitations.ts`
  - `src/lib/api/branches.ts`
  - `src/lib/api/activity-logs.ts`
  - `src/lib/api/business.ts`
- TanStack Query hooks added:
  - `src/hooks/use-invitations.ts`
  - `src/hooks/use-branches.ts`
  - `src/hooks/use-activity-logs.ts`
  - `src/hooks/use-business.ts`
- Users API now includes soft-delete and restore integration functions.
- Branch API now includes status update and user branch assignment integration.
- Roles API now includes backend `DELETE /api/v1/roles/:id` integration.
- Frontend permissions now use backend-seeded granular branch permissions such as `branches.view`, `branches.create`, `branches.edit`, `branches.status.update`, and `branches.access.manage`.
- Users now parse backend `avatar_url` and `invited` status.
- Audit logs page now attempts to load `GET /api/v1/activity-logs` for settings managers and shows a clear backend-not-connected state if the endpoint is missing.

## Recent Changes

- Wired frontend to strict backend branch isolation:
  - `/api/v1/auth/me` now parses `business_id`, `current_branch_id`, `assigned_branch_id`, `allowed_branch_ids`, and `can_access_all_branches`
  - `/api/v1/auth/me` also accepts `current_branch_name`, `assigned_branch_name`, or `branch_name` when backend sends readable branch names
  - branch switching refreshes the safe auth profile and invalidates cached operational queries
  - header branch switcher shows active allowed branches only
  - branch management create/update/status actions refresh `/api/v1/auth/me` so newly created active branches appear in the switcher without requiring logout
  - settings managers can see active branch options in the switcher, while backend still rejects unauthorized branch switches
  - POS uses `current_branch_id` instead of the first active branch
  - POS resolves the current branch label from the branch list, current branch detail, or `/auth/me` branch-name fields before falling back to generic text
  - purchasing, manufacturing, inventory opening stock, bakery orders, and payment reconciliation create flows default to the current branch instead of offering all active branches
- Updated Staff Management branch assignment:
  - direct Create User and Edit User dialogs now include an assigned branch selector
  - Invite User continues to include assigned branch selection
  - Staff table shows the assigned branch column
  - Staff filters include a branch filter for users who can access all branches or multiple allowed branches
  - Staff branch filter auto-syncs to `/auth/me.current_branch_id` after branch switching
  - branch options are active branches, with the existing assigned branch preserved while editing historical users
- Added active-branch filtering for operational selectors:
  - purchasing order, invoice, and receive-stock dialogs now hide inactive branches for new records
  - manufacturing batch creation now hides inactive branches
  - inventory opening stock and bakery order branch selectors now use active branches only for new work
  - payment reconciliation creation now uses active branches only
  - purchasing and manufacturing branch option parsers now preserve backend branch status so UI filtering is based on backend source-of-truth state
- Completed Sprint 4.3 Manufacturing frontend:
  - added `/manufacturing`, `/manufacturing/batches`, and `/manufacturing/batches/[id]`
  - connected manufacturing summary, batch list/detail/create/update/status/delete, start, consume, produce, complete, cancel, ingredients, packaging, outputs, wastage, products, recipe-by-product, inventory, units, and branches APIs
  - added typed manufacturing domain types, Zod schemas, TanStack Query hooks, permission-aware navigation, batch table, create/edit dialog, progress card, ingredient consumption UI, packaging/output/wastage sections, timeline, and reusable loading/empty/error/access-denied states
  - uses `manufacturing.view/manage` with `inventory.view/manage` fallback until every tenant is seeded with dedicated manufacturing permissions
- Completed Sprint 3.4 Purchasing frontend:
  - added `/purchasing`, `/purchasing/orders`, `/purchasing/orders/[id]`, `/purchasing/invoices`, `/purchasing/invoices/[id]`, `/purchasing/receipts`, and `/purchasing/receipts/[id]`
  - connected purchasing summary, purchase order list/detail/create/update/status/delete, purchase invoice list/detail/create/update/post/cancel, receive stock, purchase receipt list/detail/post/cancel, supplier lookup, products, units, tax rates, and branches APIs
  - added typed purchasing domain types, Zod schemas, TanStack Query hooks, permission-aware navigation, shared item line editor, supplier select, order/invoice/receipt tables, forms, detail pages, and reusable loading/empty/error/access-denied states
  - uses `purchasing.view/manage` with `inventory.view/manage` fallback until every tenant is seeded with dedicated purchasing permissions
- Completed Sprint 4.2 Recipes BOM frontend:
  - added `/recipes` and `/recipes/[id]` with `/recipes/new` handled by the dynamic recipe editor route
  - connected recipe list/detail/create/update/status/delete, ingredient lines, packaging lines, cost, cost recalculation, versions, product recipe lookup, recipe lookup, products, inventory, packaging, and units APIs
  - added typed recipe domain types, Zod schemas, TanStack Query hooks, permission-aware navigation, recipe table, create/edit page, BOM line editors, cost card, yield card, instructions card, version dialog, and reusable loading/empty/error/access-denied states
  - uses `recipes.view/manage` with `products.view/manage` fallback until every tenant is seeded with dedicated recipe permissions
- Completed Sprint 4.1 Packaging frontend:
  - added `/packaging` and `/packaging/[id]`
  - connected packaging list/detail, create/edit/status/delete, lookup, product usage rules, packaging category, supplier lookup, and units APIs
  - added typed packaging domain types, Zod schemas, TanStack Query hooks, permission-aware navigation, packaging table, detail profile, usage rules section, and reusable loading/empty/error/access-denied states
  - uses `master_data.view/manage` because Packaging is part of the Master Data foundation
- Added frontend design system foundation:
  - documented shadcn/ui and magicui usage rules in `docs/frontend-design-system.md`
  - added app wrapper components for buttons, cards, inputs, selects, badges, dialogs, sheets, confirmations, empty states, page headers, section cards, tables, and generic data tables
  - defined module-specific component strategy for Auth, Dashboard, Users/Roles, Settings, Products, POS, Inventory, Stock Movements, Suppliers, Purchasing, and Reports
  - documented accessibility, motion, installation batches, and developer guidelines so future modules do not randomly choose components
- Completed Sprint 3.3 Suppliers frontend:
  - added `/suppliers` and `/suppliers/[id]`
  - connected supplier list/detail, create/edit/status/delete, lookup, contacts, notes, stats, and supplier category APIs
  - added typed supplier domain types, Zod schemas, TanStack Query hooks, permission-aware navigation, supplier table, detail profile, contacts section, notes section, and reusable loading/empty/error/access-denied states
  - uses `suppliers.view/manage` with `inventory.view/manage` fallback until all tenants are seeded with dedicated supplier permissions
- Completed Sprint 3.1 Inventory frontend foundation:
  - added `/inventory`, `/inventory/movements`, `/inventory/low-stock`, and `/inventory/expiry-alerts`
  - connected inventory list/detail, opening stock, stock adjustments, movement history, low stock, expiry alerts, and expiry batch APIs
  - added typed inventory domain types, Zod schemas, TanStack Query hooks, permission-aware navigation, dialogs, drawer, and reusable inventory tables/states
  - product opening stock is live; ingredient and packaging selectors are intentionally prepared as placeholders until those modules are built
- Completed Sprint 3.2 Stock Movements frontend:
  - upgraded `/inventory/movements` to the dedicated `/api/v1/stock-movements` ledger APIs
  - added `/inventory/movements/[id]` and `/inventory/audit/[inventoryItemId]`
  - connected movement list/detail, inventory-item movement history, manual movement, reversal, summary, and audit APIs
  - added typed stock movement domain types, Zod schemas, TanStack Query hooks, permission-aware actions, detail drawer, reversal dialog, manual movement dialog, and audit result UI
- Finalized Sprint 2.3 Payments frontend:
  - added by-method collection summary cards
  - added refund edge-case UI, remaining-refundable validation, and disabled refund reasons
  - improved payment details with refund history and receipt placeholder
  - improved reconciliation difference display and create-result feedback
- Finalized Sprint 2.4 Customers frontend:
  - connected customer tag assignment APIs
  - expanded customer stats display for paid/refunded/net-spent values
  - debounced POS customer lookup and added status-aware selectable/disabled results
  - tightened customer note and tag validation against finalized backend rules
- Completed Sprint 2.4 Customers frontend foundation:
  - added `/customers` and `/customers/[id]`
  - connected customer CRUD, status, delete, lookup, quick-create, tags, notes, and stats APIs
  - added typed customer domain types, Zod schemas, TanStack Query hooks, permission-aware UI, and POS customer selection
- Completed Sprint 2.3 Payments frontend foundation:
  - added `/payments`, `/payments/refunds`, and `/payments/reconciliations`
  - connected payment list/detail, sale payments, add payment, refunds, daily summary, by-method summary, and reconciliation APIs
  - added typed payment domain types, Zod schemas, TanStack Query hooks, permission-aware UI, and reusable payment tables/dialogs/drawers
- Wired POS split-payment UI:
  - selecting multiple payment methods creates multiple checkout payment rows
  - each row supports amount entry and reference input when the payment method requires it
  - POS totals show paid amount, balance due, and change amount before checkout
- Simplified the POS cart area:
  - default cart view now prioritizes active cart items, compact subtotal/discount/tax/total, Hold/Clear, and Complete Checkout
  - sale discount, payment method selection, paid amount, balance, change, and final confirmation now live in the checkout payment dialog
- Started Sprint 2 and completed Sprint 2.1 Products frontend foundation:
  - added `/products` route and sidebar entry
  - connected products list/create/edit/status/delete flows
  - connected product variants list/create/edit/status/delete flows
  - connected product form category/unit/tax selectors to master-data/settings endpoints
  - added products hooks, typed API client, and products UI components with loading/empty/error/access-denied states
- Completed Sprint 2.2 POS Billing frontend foundation:
  - moved `/pos` into a dedicated `(pos)` route group with fullscreen layout
  - connected live POS product list, category filters, barcode/product lookup, checkout, receipt, and payment method contracts
  - added local cart state, quantity controls, discounts, payment panel, checkout dialog, receipt dialog, mobile cart drawer, and POS keyboard shortcuts
  - kept backend checkout as the final calculation authority while showing frontend estimated totals for cashier UX
- Replaced Products and Product Variants `Image URL` fields with Appwrite Storage upload controls:
  - uploads selected image files to `NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID`
  - sends returned Appwrite `fileId` to the backend as `image_file_id`
  - keeps `image_url` as legacy/null compatibility data
  - renders product images through Appwrite file preview URLs
- Replaced Ingredients and Packaging manual image URL fields with the same Appwrite Storage upload pattern:
  - uploads selected images to the product image bucket for now
  - sends `image_file_id` on create/update payloads and keeps `image_url` as backend fallback compatibility
  - previews images from Appwrite Storage first, then falls back to legacy `image_url`
- Fixed root hydration mismatch handling for extension-injected HTML attributes by suppressing root hydration warnings in `src/app/layout.tsx`.
- Added `data-scroll-behavior="smooth"` to the root `<html>` element to satisfy Next.js route transition expectations.
- Fixed dashboard breadcrumb rendering by removing invalid nested `<li>` markup in the header breadcrumb composition.
- Hardened frontend auth and API integration:
  - corrected backend base URL handling
  - stopped unnecessary unauthenticated Appwrite restore probes
  - mapped auth and users payloads to backend snake_case contracts
  - aligned `login-sync` to send Appwrite JWT in the backend-required JSON body
- Connected forgot/reset password forms to the backend password reset APIs instead of calling Appwrite recovery directly from the frontend.
- Connected logout to backend `POST /api/v1/auth/logout-sync` before deleting the Appwrite session, with best-effort fallback so logout cannot be blocked by audit failure.
- Built the real Branch Management UI under `/settings/branches` and connected it to the existing branch API client/hooks.
- Built invitation-based staff onboarding UI with admin invitation creation, pending invitation management, resend/cancel actions, and public invitation acceptance.
- Added POS module foundation with `/pos`, permission-aware navigation, register shell, static product tiles, and cart/payment placeholders.
- Completed Phase 4 users module integration with typed API hooks, dialogs, status actions, and permission-aware states.
- Completed Phase 5 roles module integration with:
  - real backend `GET /api/v1/roles`
  - real backend `POST /api/v1/roles`
  - real backend `PATCH /api/v1/roles/:id`
  - real backend `GET /api/v1/permissions`
  - permission matrix persistence through backend `permission_keys`
- Replaced the old `/roles` placeholder with a real permission-aware management UI.
- Updated the Users dialog to consume backend roles data when allowed, while preserving a fallback path for users-only permission sets.
- Improved backend error parsing so auth and API failures surface the actual backend reason when the Go API responds with its `error` wrapper shape.
- Normalized phone numbers before owner and staff creation requests so Appwrite-facing signup flows are less likely to fail on formatted phone input.
- Improved signup duplicate-account feedback by mapping Appwrite duplicate identity failures to the email and phone fields in the owner registration form.
- Updated owner registration flow so successful signup immediately creates an Appwrite browser session, calls backend `login-sync`, stores the safe profile in `AuthProvider`, and redirects to `/dashboard` using the newly registered owner's JWT.
- Displayed real backend `subscription_status` on the dashboard subscription card instead of the old placeholder status.
- Updated frontend role-permission integration to use backend `GET /api/v1/roles/:id/permissions` and `PATCH /api/v1/roles/:id/permissions` now that those endpoints exist.
- Expanded auth permission parsing to preserve the full backend permission set instead of only early users/roles/settings permissions.
- Improved API parse errors so non-JSON backend responses include a short response excerpt in the UI for faster debugging.
- Moved the roles permission matrix out of the main page and into an action-driven dialog opened from `View permissions` or `Manage permissions` in the row actions menu.
- Completed Phase 6 settings placeholder UI with reusable settings cards, section constants, permission-aware rendering, and coming-soon route behavior.
- Added frontend admin hardening routes for business onboarding, account profile, and audit-log readiness.
- Added global API `401` session-expiry handling so stale Appwrite sessions are cleaned up and redirected to login consistently.
- Updated dashboard and header navigation to expose onboarding/profile/admin readiness flows without pretending backend-only features are complete.
- Added backend contract documentation and strict TypeScript contract types for staff invitations, branches, user soft-delete, and activity logs.
- Connected the frontend API layer to the new admin backend contracts for staff invitations, branches, user branch assignment, soft-delete/restore, and activity logs.
- Aligned frontend admin API contracts with the backend README: branch permissions, invited users, avatar URL fields, invitation action responses, branch status updates, and role deletion.
- Replaced the permanent desktop sidebar with a shadcn Sheet hamburger sidebar used consistently across desktop, tablet, and mobile.
- Connected backend Phase 1 business workspace APIs:
  - `GET /api/v1/business`
  - `PATCH /api/v1/business`
  - `GET /api/v1/business/onboarding-status`
  - `GET /api/v1/settings`
  - `PATCH /api/v1/settings`
  - `POST /api/v1/auth/switch-branch`
- Updated onboarding/profile/header UI to consume real business workspace data instead of static placeholders where backend data exists.
- Connected backend Phase 2.7 Settings + Master Data read foundation:
  - `GET /api/v1/settings/company`
  - `GET /api/v1/settings/overview`
  - `GET /api/v1/settings/tax-rates`
  - `GET /api/v1/settings/payment-methods`
  - `GET /api/v1/master-data/overview`
  - `GET /api/v1/master-data/unit-categories`
  - `GET /api/v1/master-data/units`
  - `GET /api/v1/master-data/product-categories`
  - `GET /api/v1/master-data/ingredient-categories`
  - `GET /api/v1/master-data/packaging-categories`
  - `GET /api/v1/master-data/supplier-categories`
  - `GET /api/v1/master-data/order-statuses`
  - `GET /api/v1/master-data/payment-statuses`
- Connected Units management under `/settings/master-data/units`:
  - lists units through `GET /api/v1/master-data/units`
  - creates units through `POST /api/v1/master-data/units`
  - updates units through `PATCH /api/v1/master-data/units/:id`
  - changes status through `PATCH /api/v1/master-data/units/:id/status`
  - deactivates units through `DELETE /api/v1/master-data/units/:id`
  - uses `GET /api/v1/master-data/unit-categories` for the unit category selector
  - uses `master_data.view` plus granular unit/category management permissions
- Added Company Settings edit flow inside `/settings/company-profile`:
  - reads overview cards from `GET /api/v1/settings/overview`
  - saves profile edits through `PATCH /api/v1/settings/company`
  - shows edit action only with `settings.company.update`
  - shows view-only permission messaging for `settings.view` users
- Connected Tax Rates management under `/settings/tax-rates`:
  - lists tax rates through `GET /api/v1/settings/tax-rates`
  - creates tax rates through `POST /api/v1/settings/tax-rates`
  - updates tax rates through `PATCH /api/v1/settings/tax-rates/:id`
  - changes status through `PATCH /api/v1/settings/tax-rates/:id/status`
  - deactivates tax rates through `DELETE /api/v1/settings/tax-rates/:id`
  - uses `settings.view` and `settings.tax_rates.manage` permissions
- Connected Payment Methods management under `/settings/payment-methods`:
  - lists methods through `GET /api/v1/settings/payment-methods`
  - creates methods through `POST /api/v1/settings/payment-methods`
  - updates methods through `PATCH /api/v1/settings/payment-methods/:id`
  - changes status through `PATCH /api/v1/settings/payment-methods/:id/status`
  - deactivates methods through `DELETE /api/v1/settings/payment-methods/:id`
  - uses `settings.view` and `settings.payment_methods.manage` permissions
- Connected Product Categories management under `/settings/master-data/product-categories`:
  - lists categories through `GET /api/v1/master-data/product-categories`
  - creates categories through `POST /api/v1/master-data/product-categories`
  - updates categories through `PATCH /api/v1/master-data/product-categories/:id`
  - changes status through `PATCH /api/v1/master-data/product-categories/:id/status`
  - deactivates categories through `DELETE /api/v1/master-data/product-categories/:id`
  - uses `master_data.view` and `master_data.product_categories.manage` permissions
- Connected Ingredient Categories management under `/settings/master-data/ingredient-categories`:
  - lists categories through `GET /api/v1/master-data/ingredient-categories`
  - creates categories through `POST /api/v1/master-data/ingredient-categories`
  - updates categories through `PATCH /api/v1/master-data/ingredient-categories/:id`
  - changes status through `PATCH /api/v1/master-data/ingredient-categories/:id/status`
  - deactivates categories through `DELETE /api/v1/master-data/ingredient-categories/:id`
  - uses `master_data.view` and `master_data.ingredient_categories.manage` permissions
- Connected Packaging Categories management under `/settings/master-data/packaging-categories`:
  - lists categories through `GET /api/v1/master-data/packaging-categories`
  - creates categories through `POST /api/v1/master-data/packaging-categories`
  - updates categories through `PATCH /api/v1/master-data/packaging-categories/:id`
  - changes status through `PATCH /api/v1/master-data/packaging-categories/:id/status`
  - deactivates categories through `DELETE /api/v1/master-data/packaging-categories/:id`
  - uses `master_data.view` and `master_data.packaging_categories.manage` permissions
- Connected Supplier Categories management under `/settings/master-data/supplier-categories`:
  - lists categories through `GET /api/v1/master-data/supplier-categories`
  - creates categories through `POST /api/v1/master-data/supplier-categories`
  - updates categories through `PATCH /api/v1/master-data/supplier-categories/:id`
  - changes status through `PATCH /api/v1/master-data/supplier-categories/:id/status`
  - deactivates categories through `DELETE /api/v1/master-data/supplier-categories/:id`
  - uses `master_data.view` and `master_data.supplier_categories.manage` permissions
- Added branch setup category copy support under Product, Ingredient, Packaging, and Supplier category pages:
  - calls `POST /api/v1/master-data/categories/copy`
  - maps the active page to backend `category_type`
  - copies into `/api/v1/auth/me.current_branch_id`, so users must switch to the target branch first
  - source branch dropdown uses active branches and excludes the current target branch
  - duplicate categories are left to backend handling and surfaced as copied/skipped counts
  - copy actions are gated by the matching granular category manage permission
- Connected Order Statuses management under `/settings/master-data/order-statuses`:
  - lists statuses through `GET /api/v1/master-data/order-statuses`
  - creates statuses through `POST /api/v1/master-data/order-statuses`
  - updates statuses through `PATCH /api/v1/master-data/order-statuses/:id`
  - changes status through `PATCH /api/v1/master-data/order-statuses/:id/status`
  - uses `master_data.view` and `master_data.order_statuses.manage` permissions
- Connected Payment Statuses management under `/settings/master-data/payment-statuses`:
  - lists statuses through `GET /api/v1/master-data/payment-statuses`
  - creates statuses through `POST /api/v1/master-data/payment-statuses`
  - updates statuses through `PATCH /api/v1/master-data/payment-statuses/:id`
  - changes status through `PATCH /api/v1/master-data/payment-statuses/:id/status`
  - uses `master_data.view` and `master_data.payment_statuses.manage` permissions
- Aligned Branch Management with the Phase 2.7 branch contract, including manager assignment field, default branch display, and no frontend `business_id` submission.
- Replaced the raw Branch Manager UUID input with a dropdown sourced from active users whose role name indicates manager/admin/owner access. The dropdown is available only when the current user can also view users.
- Branch tables now display the manager name instead of the raw manager user ID when the manager user is available in the loaded staff list.

## Known Limitations

- Backend `/api/v1/auth/me` does not currently return `business_name`, so the shell uses a fallback business label.
- Business onboarding now consumes backend onboarding status. Deeper setup forms for receipt and POS readiness are still future feature work.
- Company Settings edit, Tax Rates management, Payment Methods management, Units management, Product Categories management, Ingredient Categories management, Packaging Categories management, Supplier Categories management, Order Statuses management, and Payment Statuses management are connected.
- Admin audit logs are connected to:
  - `GET /api/v1/activity-logs?entity_type=user&limit=50&cursor=`
  - `GET /api/v1/users/:id/activity?limit=50&cursor=`
  - The page includes entity filtering and cursor-based pagination for both global and user activity streams.
- Branch switching is connected to the current backend branch switch endpoint. Multi-business switching is not implemented.
- Staff invite and activation are not fully defined yet.
  - Current staff creation depends on the backend `POST /api/v1/users` behavior, including Appwrite user creation and password handling.
- Email verification and password recovery use Appwrite client flows.
  - They should be tested end-to-end against the production Appwrite domain before release.
- Appwrite production session hardening still requires using a proper custom domain/API endpoint configuration in Appwrite.
- Backend `POST /api/v1/users` requires `password`.
  - Because of that, the create-user dialog includes a password field even though the initial frontend request list did not include one.
- Backend create-user endpoint does not accept `status` directly.
  - Frontend handles non-default create status by calling the dedicated status endpoint immediately after successful creation.
- Backend does not currently expose a persisted role `status` field.
  - The roles UI treats current backend roles as active and shows status as read-only.
- Backend does not currently expose `GET /api/v1/roles/:id`.
  - Frontend emulates role detail from `GET /api/v1/roles`.
- Frontend builds and persists the selected permission matrix through the dedicated role-permission endpoints.
- Backend `GET /api/v1/permissions` now returns grouped granular permissions and is expected to allow role-permission readers/managers.
  - Frontend still supports legacy flat permission payloads for backward compatibility.
  - Old broad `module.manage` keys are treated as hidden backend fallback only and are not rendered in the Permission Matrix.
  - Frontend page/button/sidebar checks use granular action permissions from `/api/v1/auth/me` instead of hardcoded broad `.manage` permissions.
- Backend role list responses do not currently include `users_count`.
  - Assigned user counts are shown only when the current account also has `users.view`, because the frontend must derive counts from the users list.

## Brand System

Tailwind brand palette:

```ts
brand: {
  latte: "#F3E9D7",
  cappuccino: "#D6BFA6",
  caramel: "#B08968",
  mocha: "#7A553A",
  espresso: "#3B2A22"
}
```

Primary usage:

- Background: `brand.latte`
- Panels: warm white and `brand.cappuccino` variants
- Primary actions: `brand.caramel`
- Text: `brand.espresso`
- Hover states: `brand.mocha`
- Sidebar: `brand.espresso` with `brand.latte` text

## Project Structure

Current implemented structure:

```text
src/
  app/
    (auth)/
      accept-invitation/
      forgot-password/
      login/
      reset-password/
      signup/
      verify-email/
    (dashboard)/
      products/
      customers/
        [id]/
      payments/
        refunds/
        reconciliations/
      dashboard/
      audit-logs/
      onboarding/
      profile/
      roles/
      settings/
        branches/
      users/
      layout.tsx
    (pos)/
      pos/
      layout.tsx
    globals.css
    layout.tsx
    page.tsx
  components/
    auth/
    admin/
    branches/
    layout/
    pos/
    payments/
    customers/
    products/
    roles/
    settings/
    shared/
    ui/
    users/
  constants/
    permissions.ts
    routes.ts
    settings.ts
  hooks/
    use-activity-logs.ts
    use-branches.ts
    use-auth.ts
    use-business.ts
    use-master-data.ts
    use-settings-data.ts
    use-invitations.ts
    use-permissions.ts
    use-permission.ts
    use-pos-cart.ts
    use-pos-checkout.ts
    use-pos-products.ts
    use-payments.ts
    use-customers.ts
    use-products.ts
    use-roles.ts
    use-users.ts
  lib/
    api/
      activity-logs.ts
      branches.ts
      business.ts
      pos.ts
      payments.ts
      customers.ts
      products.ts
      master-data.ts
      settings-data.ts
      invitations.ts
      appwrite/
    utils/
    validators/
      pos.schema.ts
      payment.schema.ts
      customer.schema.ts
  providers/
    app-providers.tsx
    auth-provider.tsx
    query-provider.tsx
  types/
    api.ts
    activity-log.ts
    auth.ts
    branch.ts
    business.ts
    master-data.ts
    invitation.ts
    permission.ts
    pos.ts
    payment.ts
    customer.ts
    product.ts
    role.ts
    settings.ts
    user.ts
  validators/
    auth.schema.ts
scripts/
  check-no-any.mjs
```

## Environment Variables

Create `.env.local` or `.env` from `.env.example`:

```bash
cp .env.example .env.local
```

Set:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID=
NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID=
NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID=
NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

`NEXT_PUBLIC_API_BASE_URL` must be the full base URL of the Go backend origin only.

Examples:

- Local: `http://localhost:8080`
- Production: `https://api.yourdomain.com`

Do not include `/api/v1` in that variable.

Storage bucket env values should match the backend/Appwrite bucket configuration:

- `NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID`: product, product variant, ingredient, and packaging images
- `NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID`: business logos, receipt logos, invoice assets
- `NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID`: owner and staff profile photos
- `NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID`: supplier docs, invoice files, purchase docs, and attachments

## Setup

Use pnpm only.

```bash
pnpm install
pnpm dev
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check
pnpm check:no-any
```

## Auth Flow Notes

### Signup

Frontend validates the form with Zod and React Hook Form, then calls:

```text
POST /api/v1/auth/register-owner
```

The frontend maps camelCase form values into the snake_case backend contract.

After successful backend owner registration:

1. Frontend creates an Appwrite email/password session for the newly created owner.
2. Frontend generates an Appwrite JWT from that new browser session.
3. Frontend calls `POST /api/v1/auth/login-sync`.
4. `AuthProvider` stores the safe profile for the newly registered owner.
5. The app redirects to `/dashboard`.

### Logout

1. Frontend calls:

```text
POST /api/v1/auth/logout-sync
```

2. Backend records logout audit activity.
3. Frontend deletes the current Appwrite session.
4. Frontend clears local auth state and redirects to `/login`.
5. If backend logout sync fails, frontend still deletes the Appwrite session and completes logout.

### Login

1. Login is performed with Appwrite email/password session creation.
2. Frontend generates an Appwrite JWT from the logged-in session.
3. Frontend sends that JWT to:

```text
POST /api/v1/auth/login-sync
```

4. The safe user profile is stored in `AuthProvider`.
5. Sensitive tokens are not stored in `localStorage`.

### Session Restore

On app load:

1. Check whether Appwrite has a stored fallback session.
2. If present, call Appwrite session/account APIs.
3. Call:

```text
GET /api/v1/auth/me
```

4. Restore the safe profile into provider state.
5. If backend sync fails, clear the Appwrite session and fall back to `/login`.

### Password Recovery

- Forgot password calls:

```text
POST /api/v1/auth/password-reset/request
```

- Reset password consumes `userId` and `secret` from query params, then calls:

```text
POST /api/v1/auth/password-reset/complete
```

- The backend owns the Appwrite recovery request/update behavior.

### Email Verification

- Verification uses Appwrite verification links.
- The `/verify-email` page supports both direct link verification and resend action.

## Quality Gates

Pre-commit runs:

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm check:no-any
```

## Validation Status

Current frontend validation passes:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm check:no-any`

## Next Planned Stage

Next recommended step:

1. Implement the documented backend contracts in `docs/backend-contracts.md`.
2. Replace raw password staff creation with invitation-based onboarding once those endpoints exist.
3. Connect branch assignment to the real branch table through `GET /api/v1/branches`.
4. Add soft-delete/restore and user activity history to the Users UI after backend support lands.
5. Continue Sprint 2 with customers, receipt hardening, and payment/POS polish after live backend QA.
