# Pastries_POS Regression Test Suite

Last updated: 2026-05-22

This suite is for local QA only. Do not point these tests at production databases, production Appwrite projects, production buckets, or production API endpoints.

## Scope

Regression coverage includes:

- Auth and Appwrite session sync
- POS checkout, cart, discounts, payments, receipts, held sales, refunds, and voids
- Catalog data used by sales and operations: products, variants, customers, suppliers, ingredients, packaging, recipes
- Inventory, stock locations, movements, expiry batches, low stock, transfers, and audit views
- Staff users, invitations, roles, permissions, branch access, and audit logs
- Purchasing, bakery orders, manufacturing, and downstream stock/accounting effects
- Reports and export flows
- Accounting chart of accounts, journals, posting, reversal, and financial statements

## Local Test Environment

Use this stack for regression:

| Area | Local target |
| --- | --- |
| Frontend | `http://localhost:3000` |
| Backend | `http://localhost:18080` or another non-production local port |
| Database | Local PostgreSQL database, for example `pastries_pos` on `127.0.0.1:5432` |
| Auth | Appwrite project configured for local web platform origin |
| Browser | Chromium/Chrome plus at least one manual pass in another browser |

Required environment rules:

- `NEXT_PUBLIC_API_BASE_URL` must point to the local backend.
- Backend `DATABASE_URL` must point to local PostgreSQL.
- Appwrite endpoint/project may be remote auth infrastructure, but must be the QA/local project configuration, not production.
- If testing high-volume route sweeps, prefer the local E2E auth-token path to avoid Appwrite `/account/jwts` rate limits.
- Test data must be clearly prefixed, for example `QA-REG-`.

## Regression Gates

Run these before manual E2E:

| Gate | Command | Pass criteria |
| --- | --- | --- |
| Backend unit tests | `cd backend && go test ./...` | All packages pass |
| Backend compile | `cd backend && go build ./...` | No compile errors |
| Migrations | `cd backend && go run ./cmd/migrate` with local DB env | No failed migration |
| Frontend lint | `cd frontend && pnpm lint` | No lint errors |
| Frontend typecheck | `cd frontend && pnpm typecheck` | No TypeScript errors |
| Frontend format | `cd frontend && pnpm format:check` | No formatting drift |
| Frontend build | `cd frontend && pnpm build` | Build completes |

## Test Data Baseline

Create or seed these records before full regression:

| Data | Minimum records |
| --- | --- |
| Branches | Main branch plus secondary branch |
| Users | Owner/admin, cashier, production user, purchasing user, restricted viewer |
| Roles | Admin, cashier, inventory manager, production manager, purchasing, accountant, report viewer |
| Products | Taxable product, tax-exempt product, product with variants, product with recipe, inactive product |
| Customers | Walk-in customer, credit customer, customer with notes/tags |
| Payment methods | Cash, card, bank transfer, mixed payment method coverage |
| Tax rates | Active rate, inactive rate |
| Ingredients | Stocked ingredient with reorder level, expiring ingredient, inactive ingredient |
| Packaging | Packaging item with stock and product rule |
| Recipes | Recipe with ingredients, packaging, yield, cost recalculation |
| Inventory | Opening stock for products, ingredients, packaging across locations |
| Purchasing | Supplier, purchase order, invoice, receipt, supplier payment |
| Bakery orders | Pickup order, delivery order, partially paid order, production-linked order |
| Accounting | Default chart of accounts, draft journal, posted journal, reversed journal |

## Severity and Priority

| Priority | Meaning |
| --- | --- |
| P0 | Blocks login, checkout, payment, inventory correctness, accounting correctness, or data security |
| P1 | Breaks an important workflow but has a workaround |
| P2 | UI, filtering, export, edge behavior, or lower-risk regression |

## Full Regression Matrix

| ID | Priority | Area | Test | Steps | Expected result |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | P0 | Login | Valid Appwrite login syncs backend profile | Open `/login`, sign in as admin, wait for redirect | User lands on dashboard; `/api/v1/auth/login-sync` and `/api/v1/auth/me` succeed; branch/role context appears |
| AUTH-002 | P0 | Login | Invalid password rejected | Sign in with valid email and wrong password | User remains on login; clear error is shown; no backend session is created |
| AUTH-003 | P0 | Login | Inactive local user cannot enter app | Disable a local user, then sign in through Appwrite | Backend rejects profile sync; UI shows access error; protected routes are blocked |
| AUTH-004 | P1 | Login | Existing Appwrite browser session handling | Sign in, revisit `/login` | Existing-session banner appears; continue session works; restart login clears session path |
| AUTH-005 | P1 | Login | Logout clears app session | Log in, choose logout, visit `/dashboard` | User is redirected to `/login`; protected data is not visible |
| AUTH-006 | P1 | Login | Password reset request | Open `/forgot-password`, submit known local QA email | Appwrite recovery request is accepted or a safe generic message is shown |
| AUTH-007 | P1 | Login | Reset password validation | Submit mismatched or weak password on `/reset-password` | Validation blocks submit with field-level messages |
| AUTH-008 | P1 | Invitation | Invitation acceptance | Create staff invitation, open accept link, set password | Appwrite user is linked to local user; user can log in with assigned role |
| AUTH-009 | P0 | Session | Expired backend token behavior | Force stale JWT or delete Appwrite session, then call protected page | UI redirects to `/login`; no infinite request loop |
| AUTH-010 | P1 | Session | Appwrite JWT rate limit message | Trigger Appwrite 429 in QA or mock it | User sees actionable rate-limit message; app does not silently fail |
| NAV-001 | P0 | Routing | Protected route smoke | Visit all protected routes after login | Each route renders a module page or valid access-denied state; no app error screen |
| NAV-002 | P1 | Routing | Direct deep-link reload | Reload `/orders`, `/inventory/movements`, `/accounting/journal-entries` | Session restores; data loads without returning to login |
| NAV-003 | P1 | Routing | Branch switch refreshes scoped data | Switch active branch from header/control | Dashboard and list counts update to selected branch |
| POS-001 | P0 | Checkout | Product list loads for POS | Open `/pos` as cashier | Active saleable products load; inactive products are hidden |
| POS-002 | P0 | Cart | Add single item to cart | Add a normal product | Cart row appears with correct name, unit price, quantity, subtotal |
| POS-003 | P0 | Cart | Quantity increment/decrement | Add product, increase and decrease quantity | Totals update; quantity cannot go below allowed minimum |
| POS-004 | P0 | Cart | Remove item | Add product, remove it | Cart is empty; totals return to zero |
| POS-005 | P0 | Cart | Variant product selection | Add product with variants | Selected variant price/SKU is used in cart and checkout payload |
| POS-006 | P1 | Cart | Search and category filter | Search by product name and filter category | Matching products show; clear state restores full list |
| POS-007 | P0 | Discount | Apply line discount amount | Add item, apply fixed line discount | Line total decreases correctly; backend persists discount amount |
| POS-008 | P0 | Discount | Apply line discount percent | Apply percentage discount | Discount is calculated from line base price; rounding is consistent |
| POS-009 | P0 | Discount | Apply cart/order discount | Apply order-level discount | Grand total decreases; discount appears in sale details and reports |
| POS-010 | P0 | Discount | Discount permission required | Log in as user without `pos.discount.apply` | Discount control is hidden or blocked; backend rejects unauthorized discount payload |
| POS-011 | P0 | Tax | Taxable item checkout | Checkout taxable product | Tax amount is calculated and recorded correctly |
| POS-012 | P0 | Tax | Mixed taxable/non-taxable cart | Checkout cart with both item types | Tax applies only to taxable lines |
| POS-013 | P0 | Payment | Cash full payment | Checkout with cash | Sale completes; payment row is created; receipt is available; stock decreases |
| POS-014 | P0 | Payment | Card full payment | Checkout with card method | Sale completes with correct payment method summary |
| POS-015 | P0 | Payment | Split payment | Pay one sale with cash plus card | Sale balance is zero; both payments are listed |
| POS-016 | P0 | Payment | Underpayment blocked or marked correctly | Submit payment below total if not allowed | UI/backend prevent completion or sale is explicitly unpaid/partial according to business rule |
| POS-017 | P0 | Payment | Overpayment/change handling | Submit cash above total | Change due is shown or overpayment policy is enforced |
| POS-018 | P1 | Customer | Assign customer to sale | Select existing customer during checkout | Sale links to customer; customer stats/history update |
| POS-019 | P1 | Customer | Quick-create customer during checkout | Create customer from POS flow | Customer is created, selected, and persisted on sale |
| POS-020 | P1 | Held sale | Hold and resume sale | Add items, hold sale, reopen held sale | Cart restores with same items, quantities, discounts, customer |
| POS-021 | P1 | Held sale | Cancel held sale | Hold sale, cancel it | Held sale disappears; no payment/stock movement is created |
| POS-022 | P0 | Receipt | Receipt generation after checkout | Complete sale, open receipt | Receipt shows business info, branch, receipt number, lines, discounts, tax, payments, total |
| POS-023 | P1 | Receipt | Receipt layout change affects preview | Update receipt layout in settings, preview receipt | Preview reflects configured fields without breaking completed receipt data |
| POS-024 | P0 | Refund | Full refund sale | Refund a completed sale | Refund payment is recorded; stock is restored according to policy; reports update |
| POS-025 | P0 | Refund | Partial refund sale | Refund one line or partial quantity | Refund amount and stock reversal are correct |
| POS-026 | P0 | Void | Void sale permission | Void completed sale as authorized user | Sale status changes; accounting/inventory side effects follow policy |
| POS-027 | P0 | Void | Void blocked for unauthorized user | Attempt void as cashier without permission | UI/backend deny operation |
| PAY-001 | P0 | Payments | Payment list loads | Open `/payments` | List, totals, filters render without API errors |
| PAY-002 | P1 | Payments | Filter payments by date/method/status | Apply filters | Results and summary cards match selected filter |
| PAY-003 | P1 | Payments | Payment detail drawer | Open payment detail | Sale/order link, method, amount, reference, timestamps show correctly |
| PAY-004 | P0 | Refunds | Refund list reflects POS refunds | Complete refund, open `/payments/refunds` | Refund appears with correct amount, status, source sale |
| PAY-005 | P0 | Reconciliation | Create payment reconciliation | Create reconciliation for date/method | Backend saves reconciliation; list shows variance and status |
| PAY-006 | P1 | Reconciliation | Reconciliation validation | Submit invalid totals/date | Field errors appear; no record is created |
| REC-001 | P0 | Receipts | Receipt records report | Open `/reports/receipts` after sale | Receipt row exists and links to sale/payment |
| REC-002 | P1 | Receipts | Receipt export/print path | Open receipt and invoke print/download where available | Printable receipt preserves totals and business identity |
| REC-003 | P1 | Receipts | Receipt permission | Restricted user opens receipt report | Access is denied unless report permission is granted |
| INV-001 | P0 | Inventory | Inventory overview loads | Open `/inventory` | Product, ingredient, and packaging stock cards/table load |
| INV-002 | P0 | Inventory | Opening stock creation | Add opening stock for product/ingredient/packaging | Inventory item balance updates; movement ledger records opening stock |
| INV-003 | P0 | Inventory | Manual stock adjustment | Adjust item stock up/down | Quantity and valuation update; stock movement is created |
| INV-004 | P0 | Inventory | Stock cannot go negative unless allowed | Attempt invalid negative adjustment or oversell | Backend rejects or policy is explicit and visible |
| INV-005 | P0 | Inventory | POS sale decrements product stock | Checkout stock-tracked product | Inventory balance decreases and sale movement is visible |
| INV-006 | P0 | Inventory | Refund restores stock | Refund stock-tracked sale | Inventory balance changes according to refund policy |
| INV-007 | P1 | Inventory | Stock locations CRUD | Create, edit, disable, set default location | Location table updates; default rules are enforced |
| INV-008 | P0 | Inventory | Location balance accuracy | Move stock between locations | Source decreases; destination increases; total remains unchanged |
| INV-009 | P0 | Inventory | Stock transfer create/complete | Create transfer between locations and complete it | Transfer status changes; movement ledger records transfer |
| INV-010 | P1 | Inventory | Stock transfer cancel | Create transfer, cancel before completion | No final stock movement is applied |
| INV-011 | P1 | Inventory | Low-stock alert | Set reorder level above current stock | Item appears in `/inventory/low-stock` and report low-stock page |
| INV-012 | P1 | Inventory | Expiry batch alert | Create expiring batch within alert window | Item appears in expiry alerts and expiry report |
| INV-013 | P1 | Inventory | Expiry batch status update | Mark expiry batch consumed/expired/adjusted | Status updates; invalid transitions are blocked |
| INV-014 | P0 | Inventory | Movement ledger detail | Open `/inventory/movements` and movement detail | Direction, type, source document, quantity, balance impact are correct |
| INV-015 | P0 | Inventory | Reverse manual movement | Create manual movement, reverse it | Reversal movement is created; balance returns correctly |
| INV-016 | P1 | Inventory | Audit view | Open inventory audit for an item | Expected, actual, and variance are shown clearly |
| CAT-001 | P0 | Products | Product create/edit/status | Create product, edit details, deactivate/reactivate | Product state persists; inactive product is hidden from POS |
| CAT-002 | P0 | Products | Product variants | Add/edit/deactivate variant | Variant is available where expected and uses correct price/SKU |
| CAT-003 | P1 | Products | Product delete with history | Delete product with sale/inventory history | Delete is blocked with action-oriented conflict message |
| CAT-004 | P1 | Customers | Customer create/edit/status | Create, edit, deactivate/reactivate customer | Customer list and detail reflect changes |
| CAT-005 | P1 | Customers | Customer notes and tags | Add note, add tag, remove tag | Notes/tags persist and show in customer detail |
| CAT-006 | P1 | Suppliers | Supplier create/edit/status | Create supplier, add contacts/notes, deactivate | Supplier profile and lookup behave correctly |
| CAT-007 | P1 | Ingredients | Ingredient CRUD/status | Create ingredient with unit/category/reorder level; edit/status | List and detail reflect changes; inactive hidden from active lookups |
| CAT-008 | P1 | Packaging | Packaging CRUD/status | Create packaging with unit/category/cost; edit/status | Packaging lookup and inventory behave correctly |
| CAT-009 | P1 | Packaging | Product packaging rules | Add packaging rule to product | Rule appears under product packaging and recipe/order packaging flows |
| RECIP-001 | P0 | Recipes | Recipe create/edit | Create recipe with product output, ingredients, packaging, yield | Recipe saves and detail shows complete BOM |
| RECIP-002 | P0 | Recipes | Cost recalculation | Change ingredient cost, recalculate recipe cost | Recipe cost updates consistently |
| RECIP-003 | P1 | Recipes | Recipe versioning | Create new version | New version appears; historical version remains readable |
| RECIP-004 | P1 | Recipes | Recipe status | Deactivate recipe | It is not selectable for new production unless policy allows |
| PUR-001 | P0 | Purchasing | Purchase order create/edit/status | Create PO with supplier and item lines; update status | PO totals and status persist |
| PUR-002 | P0 | Purchasing | Receive purchase order stock | Receive PO items | Purchase receipt created; inventory increases |
| PUR-003 | P0 | Purchasing | Purchase invoice create/post | Create invoice, post it | Invoice status updates; payables/reporting update |
| PUR-004 | P0 | Purchasing | Supplier payment | Add payment against invoice | Invoice balance decreases; supplier payment list updates |
| PUR-005 | P1 | Purchasing | Cancel receipt/invoice | Cancel allowed document | Status and inventory/accounting effects follow policy |
| PUR-006 | P1 | Purchasing | Supplier history | Open supplier purchase history | Orders, invoices, receipts, payments are visible |
| ORD-001 | P0 | Bakery orders | Create pickup order | Create order with customer, items, due date, pickup | Order appears with correct totals/status |
| ORD-002 | P0 | Bakery orders | Create delivery order | Create order with delivery details | Delivery fields persist and reports include delivery classification |
| ORD-003 | P0 | Bakery orders | Order item edit/delete | Add, edit, delete item before locked status | Totals update; invalid edits are blocked by status |
| ORD-004 | P0 | Bakery orders | Add order payment | Add partial and final payments | Payment status updates; payment list/report reflects order payment |
| ORD-005 | P0 | Bakery orders | Assign production to order | Use order-level production assignment | Manufacturing batch link appears without breaking order status |
| ORD-006 | P0 | Bakery orders | Create production from item | Use item-level `create-production` flow | Batch is linked to the specific order item |
| ORD-007 | P1 | Bakery orders | Add packaging to order | Add packaging lines | Packaging requirement appears and affects stock when consumed by policy |
| ORD-008 | P1 | Bakery orders | Status transitions | Move order through workflow statuses | Only valid transitions are accepted; timeline updates |
| MFG-001 | P0 | Manufacturing | Batch create | Create batch from recipe/product | Batch has planned quantity, recipe, branch, status |
| MFG-002 | P0 | Manufacturing | Start batch | Start planned batch | Status changes to in progress; timeline updates |
| MFG-003 | P0 | Manufacturing | Consume ingredients | Consume ingredient quantities | Ingredient inventory decreases; consumption rows show variance |
| MFG-004 | P0 | Manufacturing | Produce output | Record produced quantity | Product inventory increases; yield variance is calculated |
| MFG-005 | P1 | Manufacturing | Record wastage | Add wastage during/after batch | Wastage is visible in batch and manufacturing reports |
| MFG-006 | P1 | Manufacturing | Complete batch | Complete batch after required steps | Status locks correctly; further invalid edits are blocked |
| MFG-007 | P1 | Manufacturing | Cancel batch | Cancel eligible batch | Inventory side effects are reversed or blocked according to policy |
| RBAC-001 | P0 | Staff roles | Users list permission | Log in as user with/without `users.view` | Authorized user sees list; unauthorized user sees access denied |
| RBAC-002 | P0 | Staff roles | Invite staff | Admin invites staff with role and branch | Pending invitation appears; email/Appwrite path is triggered |
| RBAC-003 | P1 | Staff roles | Resend/cancel invitation | Resend then cancel invitation | Status and audit logs update |
| RBAC-004 | P0 | Staff roles | Create custom role | Create role with selected permissions | Role appears and can be assigned |
| RBAC-005 | P0 | Staff roles | Update role permissions | Remove permission from role | User loses access after refresh/relogin; backend also rejects API call |
| RBAC-006 | P0 | Staff roles | Branch access scoping | Assign user to one branch only | User cannot see data from other branch |
| RBAC-007 | P0 | Staff roles | Cashier role minimum access | Log in as cashier | POS and cashier dashboard work; admin/settings/accounting are blocked |
| RBAC-008 | P0 | Staff roles | Production role minimum access | Log in as production user | Manufacturing and production dashboard work; POS checkout is blocked unless granted |
| RBAC-009 | P0 | Staff roles | Purchasing role minimum access | Log in as purchasing user | Purchasing dashboard/orders work; unrelated modules are blocked |
| RBAC-010 | P1 | Audit | Audit logs record sensitive actions | Create/edit/delete/status-change key entities | Audit log records actor, action, entity, timestamp |
| REP-001 | P0 | Reports | Reports dashboard | Open `/reports/dashboard` | Summary cards/charts load from local backend |
| REP-002 | P0 | Reports | Sales summary and detail reports | Open sales report pages and apply date range | Sales totals match POS completed sales |
| REP-003 | P1 | Reports | Sales by product/category/cashier/branch | Open each breakdown page | Breakdowns reconcile to sales summary |
| REP-004 | P1 | Reports | Discount/tax reports | Create discounted/taxed sales, open reports | Discount and tax amounts match sale records |
| REP-005 | P0 | Reports | Inventory reports | Open current stock, valuation, low stock, expiry, movements | Values match inventory module |
| REP-006 | P1 | Reports | Inventory audit/wastage/packaging reports | Generate relevant data and open reports | Rows match source inventory/manufacturing records |
| REP-007 | P0 | Reports | Manufacturing reports | Open batches, ingredient consumption, yield variance, recipe costs, wastage | Values match manufacturing batches |
| REP-008 | P0 | Reports | Bakery order reports | Open upcoming, status, production schedule, pending payments, delivery vs pickup | Values match bakery order data |
| REP-009 | P0 | Reports | Financial reports | Open payments, refunds, outstanding balances, supplier payables, reconciliation | Values match payments/purchasing/accounting data |
| REP-010 | P1 | Reports | Export CSV by GET/POST | Export sales, inventory, and financial reports | CSV downloads; headers and row counts match filters |
| REP-011 | P0 | Reports | Report RBAC | Restricted report viewer attempts each report family | Access follows `reports.*` permissions |
| ACC-001 | P0 | Accounting | Chart of accounts loads | Open `/accounting/chart-of-accounts` | Accounts list loads and is sorted by account code |
| ACC-002 | P0 | Accounting | Seed default accounts | Run seed-defaults from UI/API | Required default accounts are created once; rerun is idempotent |
| ACC-003 | P0 | Accounting | Create/edit account | Create child account, edit name/status | Account persists; invalid parent/type rules are blocked |
| ACC-004 | P0 | Accounting | Prevent deleting account with ledger history | Attempt delete used account | Backend blocks delete with clear message |
| ACC-005 | P0 | Accounting | Draft journal entry | Create balanced draft journal | Draft is saved; debit and credit totals equal |
| ACC-006 | P0 | Accounting | Unbalanced journal blocked | Submit debit/credit mismatch | Validation blocks post/save according to policy |
| ACC-007 | P0 | Accounting | Post journal entry | Post balanced draft | Entry becomes locked/posted; ledger balances update |
| ACC-008 | P0 | Accounting | Reverse journal entry | Reverse posted journal | Reversal entry is created; original is marked reversed or linked |
| ACC-009 | P0 | Accounting | General ledger report | Open account ledger details/general ledger | Posted and reversed entries appear correctly; drafts excluded where expected |
| ACC-010 | P0 | Accounting | Trial balance | Open trial balance for period | Debits equal credits; drafts excluded |
| ACC-011 | P0 | Accounting | Profit and loss | Open P&L | Revenue/expense totals match posted journals/sales/purchases policy |
| ACC-012 | P0 | Accounting | Balance sheet | Open balance sheet | Assets equal liabilities plus equity, or imbalance warning is explicit with difference |
| SET-001 | P1 | Settings | Company profile | Edit company info/logo fields | Changes persist and appear where used, including receipt preview |
| SET-002 | P1 | Settings | Branch management | Create/edit/status branch | Branch list updates; inactive branch cannot be selected for new work |
| SET-003 | P1 | Settings | Master units | Create/edit/status unit | Unit appears in product/ingredient/packaging/recipe forms |
| SET-004 | P1 | Settings | Categories | Manage product, ingredient, packaging, supplier categories | Categories appear in related forms and filters |
| SET-005 | P1 | Settings | Order/payment statuses | Manage statuses | Status lists update and invalid duplicate names are blocked |
| SET-006 | P1 | Settings | Payment methods | Create/edit/status method | POS/payment forms only show active methods |
| SET-007 | P1 | Settings | Tax rates | Create/edit/status tax rate | Product tax assignment and POS tax calculation use active rates |
| SET-008 | P1 | Settings | Receipt layouts | Create/edit/default/preview receipt layout | Default layout is used for new receipt previews |
| ERR-001 | P0 | Error handling | Backend offline | Stop local backend and load protected page | UI shows backend failure state; no blank screen |
| ERR-002 | P1 | Error handling | Network retry | Temporarily fail API request then retry | Retry succeeds and stale error clears |
| ERR-003 | P1 | Error handling | Validation messages | Submit invalid forms in major modules | Field-level errors are specific and preserve entered data |
| ERR-004 | P1 | Error handling | 409 conflict handling | Delete entity with operational history | UI says item cannot be deleted and suggests deactivate/archive where supported |
| UI-001 | P1 | UI | Responsive layout | Test POS, inventory, reports, accounting on desktop/tablet/mobile widths | No overlapping text; critical controls remain usable |
| UI-002 | P1 | UI | Keyboard navigation | Navigate login, POS, dialogs, tables with keyboard | Focus order is logical; modals trap focus; Escape closes dialogs |
| UI-003 | P1 | UI | Loading/empty/error states | Force empty data and API error for each major module | Skeleton, empty state, and error state render cleanly |
| UI-004 | P2 | UI | Theme consistency | Switch theme if enabled and browse major modules | Text contrast and component styling remain readable |

## P0 Smoke Subset

Run this subset before every merge or release candidate:

1. `AUTH-001`, `AUTH-002`, `AUTH-005`, `AUTH-009`
2. `NAV-001`, `NAV-002`
3. `POS-001` through `POS-005`, `POS-011`, `POS-013`, `POS-015`, `POS-022`
4. `PAY-001`, `PAY-004`
5. `INV-001` through `INV-006`, `INV-009`, `INV-014`, `INV-015`
6. `ORD-001`, `ORD-004`, `ORD-006`
7. `MFG-001`, `MFG-003`, `MFG-004`
8. `RBAC-001`, `RBAC-005`, `RBAC-006`, `RBAC-007`
9. `REP-001`, `REP-002`, `REP-005`, `REP-009`
10. `ACC-001`, `ACC-005`, `ACC-007`, `ACC-010`, `ACC-012`
11. `ERR-001`, `ERR-004`

## Route Coverage Checklist

Auth routes:

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/accept-invitation`
- `/verify-email`

Operational routes:

- `/dashboard`, `/dashboard/admin`, `/dashboard/cashier`, `/dashboard/production`, `/dashboard/purchasing`
- `/pos`
- `/products`, `/customers`, `/suppliers`, `/ingredients`, `/packaging`, `/recipes`
- `/inventory`, `/inventory/movements`, `/inventory/stock-locations`, `/inventory/location-balances`, `/inventory/low-stock`, `/inventory/expiry-alerts`, `/inventory/stock-transfers`
- `/purchasing`, `/purchasing/orders`, `/purchasing/invoices`, `/purchasing/receipts`, `/purchasing/payments`
- `/orders`
- `/manufacturing`, `/manufacturing/batches`
- `/payments`, `/payments/refunds`, `/payments/reconciliations`
- `/users`, `/roles`, `/audit-logs`
- `/settings`, `/settings/branches`, `/settings/company-profile`, `/settings/payment-methods`, `/settings/tax-rates`, `/settings/receipts`, `/settings/master-data`
- `/accounting`, `/accounting/chart-of-accounts`, `/accounting/journal-entries`, `/accounting/reports/general-ledger`, `/accounting/reports/trial-balance`, `/accounting/reports/profit-loss`, `/accounting/reports/balance-sheet`

Report routes:

- `/reports`, `/reports/dashboard`, `/reports/export`, `/reports/receipts`
- `/reports/sales`, `/reports/sales/products`, `/reports/sales/categories`, `/reports/sales/cashiers`, `/reports/sales/branches`, `/reports/sales/discounts`, `/reports/sales/taxes`
- `/reports/inventory`, `/reports/inventory/current-stock`, `/reports/inventory/valuation`, `/reports/inventory/low-stock`, `/reports/inventory/expiry`, `/reports/inventory/movements`, `/reports/inventory/wastage`, `/reports/inventory/packaging`, `/reports/inventory/audit`
- `/reports/manufacturing`, `/reports/manufacturing/batches`, `/reports/manufacturing/ingredient-consumption`, `/reports/manufacturing/yield-variance`, `/reports/manufacturing/recipe-costs`, `/reports/manufacturing/wastage`
- `/reports/bakery-orders`, `/reports/bakery-orders/upcoming`, `/reports/bakery-orders/status`, `/reports/bakery-orders/production-schedule`, `/reports/bakery-orders/pending-payments`, `/reports/bakery-orders/delivery-vs-pickup`
- `/reports/financial`, `/reports/financial/payments`, `/reports/financial/refunds`, `/reports/financial/outstanding-balances`, `/reports/financial/supplier-payables`, `/reports/financial/reconciliation`

## API Coverage Checklist

At minimum, cover these backend groups with authorized, unauthorized, validation-error, and happy-path checks:

- `/api/v1/auth`
- `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions`
- `/api/v1/branches`, `/api/v1/business`, `/api/v1/settings`, `/api/v1/master-data`
- `/api/v1/products`, `/api/v1/products/:id/variants`, `/api/v1/customers`, `/api/v1/suppliers`
- `/api/v1/ingredients`, `/api/v1/packaging`, `/api/v1/recipes`
- `/api/v1/pos`, `/api/v1/payments`
- `/api/v1/inventory`, `/api/v1/stock-movements`
- `/api/v1/purchasing`
- `/api/v1/bakery-orders`
- `/api/v1/manufacturing`
- `/api/v1/reports`
- `/api/v1/accounting`
- `/api/v1/activity-logs`

## Automation Recommendations

Recommended layers:

1. Backend unit and service tests for calculations, permissions, validation, and data integrity.
2. API integration tests against a disposable local PostgreSQL database.
3. Browser E2E tests for the P0 smoke subset.
4. Manual exploratory pass for receipt print layout, responsive POS ergonomics, and report exports.

High-value automation candidates:

- Login and protected route smoke
- POS cart/checkout/payment/receipt
- Refund and inventory reversal
- Inventory adjustment, transfer, low-stock, and expiry
- Staff role permission deny/allow checks
- Report totals reconciliation after seeded sales/inventory/manufacturing data
- Accounting journal post/reverse and statement checks

Avoid real Appwrite stress in broad route sweeps. Use one real Appwrite login smoke test, then use local E2E auth for repeated regression route traversal.

## Exit Criteria

A regression run is acceptable when:

- All P0 tests pass.
- No P1 failure affects checkout, inventory accuracy, payments, receipts, reports used for closing, role security, or accounting statements.
- Any P2 failures are documented with owner and follow-up issue.
- Local database can be reset and rerun with the same result.
- Screenshots or logs are attached for failed E2E cases.

