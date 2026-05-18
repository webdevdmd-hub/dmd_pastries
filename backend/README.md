# Pastries POS Backend

Backend foundation for a multi-tenant POS SaaS platform built with Go, Gin, GORM, PostgreSQL, and Appwrite Auth.

## Current Stage

Current backend stage: **Sprint 5.7 dashboard intelligence foundation**

This repository currently contains the backend foundation plus Sprint 2 products, POS billing, payments, held sales, customers, Sprint 3 inventory/purchasing foundations, Sprint 4.1 packaging, Sprint 4.2 recipes/BOM, Sprint 4.3 manufacturing production batches, Sprint 4.4 ingredients catalog, bakery orders, Sprint 5 reports foundation with sales, inventory, manufacturing, bakery orders, and financial/payment reports, and Sprint 5.7 dashboard intelligence APIs. Supplier payment accounting, loyalty, and online payment gateways are not built yet.

Admin maturity contracts from `frondend/docs/backend-contracts.md` are implemented for staff invitations, branch assignment, soft-delete/restore users, and activity logs.

Phase 1 adds business profile, onboarding status, business settings, current branch switching, default branch support, and versioned SQL migration files.

Phase 2.1 adds dedicated company settings and settings overview APIs.

Phase 2.2 upgrades branch settings with `branch_code`, `manager_user_id`, branch detail lookup, tenant-safe manager validation, and migration `000004_phase2_branch_settings_upgrade.sql`.

Phase 2.3 adds master data category foundations for product, ingredient, packaging, and supplier categories, plus default business seeders and migration `000005_phase2_masterdata_categories.sql`.

Phase 2.4 adds unit categories, system default units, custom tenant units, conversion metadata, and migration `000006_phase2_units_measurements.sql`.

Phase 2.5 adds tenant-scoped tax rates, default UAE VAT 5%, settings overview tax counts, and migration `000007_phase2_tax_rates.sql`.

Phase 2.6 adds tenant-scoped payment methods, default Cash/Card/Bank Transfer methods, settings overview payment counts, and migration `000008_phase2_payment_methods.sql`.

Phase 2.7 adds system default order/payment statuses, tenant custom statuses, overview counts, and migration `000009_phase2_workflow_statuses.sql`.

Sprint 2.1 adds the products module, product variants, POS product list, lookup by SKU/barcode/product code, pricing/tax placeholder tables, and migration `000010_sprint2_products.sql`.

Storage references now use Appwrite Storage file IDs instead of public URLs. Migration `000011_storage_file_ids.sql` adds `image_file_id`, `logo_file_id`, `avatar_file_id`, and product media `file_id` fields.

Sprint 2.2 adds POS billing checkout, sales, sale items, split payments, receipts, refund/void foundation, transaction-safe sale numbers, and migration `000012_sprint2_pos_billing.sql`.

Sprint 2.3 adds payment tracking, add-payment for partial sales, payment refunds, daily/by-method summaries, reconciliation foundation, richer sale payment fields, and migration `000013_sprint2_payments.sql`.

Held sales add saved-cart support for POS hold/resume/cancel flows through migration `000014_sprint2_held_sales.sql`.

Sprint 2.4 adds customer profiles, POS lookup, quick customer creation, tags, notes, customer stats, sales customer linking, and migrations `000015_sprint2_customers.sql` and `000016_customers_quick_create_contact_optional.sql`.

Sprint 3.1 adds inventory items, branch stock levels, stock movements, manual adjustments, expiry batches, low-stock alerts, expiry alerts, and migration `000017_sprint3_inventory.sql`.

Sprint 3.2 finalizes the stock movement ledger with movement direction, references, manual movements, reversal foundation, ledger summary, audit checking, and migration `000018_sprint3_stock_movements_engine.sql`.

Sprint 3.3 adds supplier profiles, supplier contacts, supplier notes, category integration, lookup, status management, placeholder supplier stats, and migration `000019_sprint3_suppliers.sql`.

Sprint 3.4 adds purchase orders, purchase invoices, purchase receipts, receiving stock-in through stock movements, supplier purchase history, purchasing summary, and migration `000020_sprint3_purchasing.sql`.

Sprint 4.1 adds packaging item catalog, packaging supplier/category/unit links, packaging inventory item creation, product packaging usage rules, lookup APIs, and migration `000021_sprint4_packaging.sql`.

Sprint 4.2 adds recipes/BOM for manufactured and made-to-order products, recipe ingredients, recipe packaging usage, costing, active recipe lookup by product, version snapshots, and migration `000022_sprint4_recipes.sql`.

Sprint 4.3 adds manufacturing production batches, recipe-based ingredient/packaging consumption, finished product stock-in, production costing, expiry batch output, stock movement integration, and migration `000023_sprint4_manufacturing.sql`.

Sprint 4.4 adds a real ingredients catalog, ingredient lookup, supplier/category/unit links, ingredient inventory item creation, recipe/purchasing/inventory integration, and migration `000024_sprint4_ingredients.sql`.

Sprint 4.4 bakery orders adds custom/made-to-order order management, pickup/delivery scheduling, customizable order items, deposit/balance payment tracking, production/packaging links, summary APIs, and migration `000025_sprint4_bakery_orders.sql`.

Branch access hardening adds authenticated branch context, strict current-branch operational scoping, allowed branch lists, all-branch explicit scope support, and migration `000026_branch_access_scope.sql`.

Default branch repair adds automatic `Main Branch` creation during owner registration and migration `000027_backfill_default_branches.sql` for existing businesses that were registered before default branch creation was enforced.

Role permission repair backfills missing predefined role permission mappings, keeps Admin on full access, allows permission edits for business default roles, and adds migration `000028_backfill_role_permissions.sql`.

Granular RBAC adds action-level permissions for every module, groups `GET /api/v1/permissions` by `module_name`, hides deprecated broad `.manage` keys from permission-management payloads, and adds migration `000029_granular_rbac_permissions.sql`.

RBAC cleanup maps existing broad `.manage` role assignments to granular action permissions, keeps `.manage` only as hidden backend fallback, and adds migration `000030_convert_manage_permissions_to_granular.sql`.

Ingredient and packaging image compatibility adds optional `image_url` fallback fields while keeping `image_file_id` as the preferred Appwrite Storage reference, and adds migration `000031_ingredient_packaging_image_url_compat.sql`.

Strict branch-owned catalog data adds `branch_id` to products, categories, customers, suppliers, ingredients, packaging, recipes, and recipe lines. Existing rows are backfilled to each business default branch, new rows default to the authenticated user's current branch, and cross-branch references are rejected. See migration `000032_strict_branch_owned_data.sql`.

Sprint 5.7 adds role-aware operational dashboard APIs for Admin, Cashier, Production, and Purchasing users, recent activity feeds, operational alerts, KPI summaries, dashboard cache placeholders, and migration `000033_dashboard_intelligence_permissions.sql`.

Receipt layout settings add POS receipt template management for 58mm, 80mm, A4, and custom billing receipts. Layouts store frontend-managed JSON design config while backend remains source of truth for sale totals and receipt data. See migration `000034_receipt_layouts.sql`.

## What Is Implemented

### Branch isolation contract

- Backend is the source of truth for branch access. Frontend branch filtering is only UX.
- `POST /api/v1/auth/register-owner` creates a default active branch named `Main Branch` with code `MAIN`, assigns it to the owner, and sets it as the owner's `current_branch_id`.
- `GET /api/v1/auth/me` returns `user_id`, `business_id`, `current_branch_id`, `assigned_branch_id`, `allowed_branch_ids`, `can_access_all_branches`, and `permissions`.
- `POST /api/v1/auth/switch-branch` updates the authenticated user's `current_branch_id` after validating that the branch is active, inside the same business, and allowed for that user.
- Normal operational APIs are scoped to `business_id + current_branch_id`. If a user is currently on Branch A, Branch B data is rejected unless they switch branch first.
- Explicit all-branch mode uses `branch_id=all` on branch-scoped list/summary APIs and is allowed only when `can_access_all_branches=true`.
- Catalog/operational records are strict branch-owned: product categories, products, customers, suppliers, ingredients, packaging items, recipes, manufacturing, purchasing, POS, payments, and bakery orders resolve records by the current branch and reject IDs from another branch.
- Business-wide records remain business-level: users, roles, permissions, branches, business profile, units/system defaults, tax/payment settings, and core company settings.
- Branch-scoped modules include POS sales/held sales/checkout, payments/refunds/reconciliations, inventory, stock movements, purchasing, manufacturing, bakery orders, branch listing/detail, and user listing/detail.

### Role permission contract

- Admin receives all available granular permissions by default and cannot be reduced below full access.
- Business default role identities are protected, but their permission sets can be edited by users with `roles.permissions.update`.
- Custom roles can be created, edited, and deleted when no users are assigned.
- The permission matrix endpoint `GET /api/v1/permissions` is available to users with `roles.permissions.view`, `roles.view`, or legacy `roles.manage`.
- Permission payloads now use action-level keys such as `products.create`, `products.edit`, `inventory.adjust`, `stock_movements.reverse`, and `orders.payments.manage`.
- Legacy broad `.manage` keys are not returned by `GET /api/v1/permissions`, role permission payloads, or `/auth/me`; they are retained only as hidden backend route-guard fallbacks for old tenants/tokens.

### Storage convention

- Frontend uploads files to Appwrite Storage first.
- Appwrite returns a `file_id`.
- Frontend sends the file ID to this backend.
- PostgreSQL stores file references only, not binary files or public URLs.
- Current storage fields are `avatar_file_id`, `logo_file_id`, `image_file_id`, and product media `file_id`.
- Ingredients and packaging prefer `image_file_id`; `image_url` is accepted/returned only as a temporary backward-compatible fallback.
- Frontend should build preview/view URLs from Appwrite using the saved file ID and bucket config.

### Phase 0.1 Environment and server setup

- Gin API server
- CORS middleware
- PostgreSQL connection through GORM
- `.env` loading through `godotenv`
- support for both `DATABASE_URL` and split `POSTGRES_*` variables
- health check route: `GET /health`
- `Dockerfile`
- `docker-compose.yml` for local development

### Phase 0.2 Core SaaS models

Implemented GORM models and schema bootstrap for:

- `businesses`
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `subscriptions`
- `audit_logs`

Design rules already applied:

- UUID primary keys
- `business_id` tenant boundary for protected records
- soft deletes where appropriate
- nullable `branch_id` on users for future branch support

### Phase 0.3 Owner registration

Implemented:

- `POST /api/v1/auth/register-owner`

Flow:

1. validate request payload
2. create Appwrite user
3. start PostgreSQL transaction
4. create business
5. seed default permissions if missing
6. create default business roles
7. attach predefined permission bundles to those roles
8. create local owner user
9. assign owner to `Admin`
10. update `owner_user_id` on business
11. create trial subscription
12. create audit log
13. commit transaction

Default roles created during owner registration:

- `Admin`
- `Cashier`
- `Manager`
- `Inventory Clerk`

Role intent:

- `Admin`: full seeded access
- `Cashier`: daily counter sales operations
- `Manager`: broader oversight across users, sales, inventory, and reports
- `Inventory Clerk`: stock and product maintenance

### Phase 0.4 Login sync

Implemented:

- `POST /api/v1/auth/login-sync`

Purpose:

- frontend logs in with Appwrite
- frontend sends Appwrite JWT to backend
- backend verifies token and syncs local profile state
- backend updates local `email_verified` from Appwrite
- backend updates `last_login_at`
- backend writes a `login_sync` audit log

Response includes:

- local user id
- Appwrite user id
- business id
- role id
- role name
- permission list
- subscription status
- profile fields

### Phase 0.5 Auth middleware

Implemented:

- verify Appwrite JWT from `Authorization: Bearer <token>`
- load local user
- block invalid, inactive, or missing users
- sync Appwrite email verification status into local user record
- optionally block unverified email users when `REQUIRE_EMAIL_VERIFICATION=true`
- attach auth context into Gin request context

### Phase 0.6 Current user route

Implemented:

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout-sync`

Returns:

- current authenticated local user
- role
- permission list
- subscription status

Logout sync behavior:

- records a backend `logout_sync` audit log
- does not delete the Appwrite frontend session by itself
- frontend must still call Appwrite logout/session deletion

### Phase 0.7 Permission middleware

Implemented reusable permission guard:

- `RequirePermission("users", "view")`
- `RequirePermission("users", "create")`
- `RequirePermission("users", "edit")`

### Phase 0.8 Basic user management

Implemented protected APIs:

- `GET /api/v1/users`
- `POST /api/v1/users`
- `POST /api/v1/users/invite`
- `POST /api/v1/users/invitations`
- `GET /api/v1/users/invitations?status=pending`
- `POST /api/v1/users/invitations/:id/resend`
- `PATCH /api/v1/users/invitations/:id/cancel`
- `GET /api/v1/users/:id`
- `GET /api/v1/users/:id/activity`
- `PATCH /api/v1/users/:id`
- `PATCH /api/v1/users/:id/branch`
- `PATCH /api/v1/users/:id/status`
- `DELETE /api/v1/users/:id`
- `PATCH /api/v1/users/:id/restore`

Rules already enforced:

- users are scoped to current `business_id`
- no cross-business access
- branch assignment must point to a real active branch in the same business
- role assignment must belong to same business or be allowed system role
- permission checks are enforced before handler execution
- user delete uses soft delete
- user activity is read from audit logs
- avatar/profile photo support is stored as `avatar_file_id`

Invitation behavior:

- `POST /api/v1/users/invitations` creates a pending invitation record
- invitation list responses never expose raw token secrets
- duplicate active users and duplicate pending invites are blocked
- `POST /api/v1/auth/accept-invitation` validates token, status, and expiry
- Appwrite user and local user are created only when the invitation is accepted

### Phase 0.8.1 Branch foundation

Implemented protected APIs:

- `GET /api/v1/branches`
- `POST /api/v1/branches`
- `GET /api/v1/branches/:id`
- `PATCH /api/v1/branches/:id`
- `PATCH /api/v1/branches/:id/status`

Behavior:

- branches are tenant-scoped by `business_id`
- branch codes are unique inside each business
- branch manager must be an existing user in the same business
- users can only be assigned to active branches in their own business
- protected by `settings.view` and `settings.manage`
- branch response uses contract fields: `name`, `branch_code`, `phone`, `email`, `manager_user_id`, `address_line_1`, `address_line_2`, `city`, `country`, `timezone`, `status`

### Admin maturity activity logs

Implemented protected APIs:

- `GET /api/v1/activity-logs?entity_type=user&limit=50&cursor=`
- `GET /api/v1/users/:id/activity?limit=50&cursor=`

Behavior:

- cursor pagination with `items` and `next_cursor`
- activity fields include `actor_user_id`, `target_user_id`, `event_type`, `entity_type`, `entity_id`, `summary`, `metadata`, and `created_at`
- business-wide activity logs require `settings.manage`

### Phase 1 business workspace APIs

Implemented protected APIs:

- `GET /api/v1/business`
- `PATCH /api/v1/business`
- `GET /api/v1/business/onboarding-status`
- `GET /api/v1/settings`
- `PATCH /api/v1/settings`
- `POST /api/v1/auth/switch-branch`

Behavior:

- business profile is tenant-scoped by authenticated user `business_id`
- onboarding status reports setup steps and completion percent
- business settings are created automatically if missing
- branch switching validates that the selected branch belongs to the same business and is active
- branch records support `is_default`

### Phase 2.1 company settings APIs

Implemented protected APIs:

- `GET /api/v1/settings/company`
- `PATCH /api/v1/settings/company`
- `GET /api/v1/settings/overview`

Behavior:

- one company settings record per business
- settings are auto-created if missing
- owner registration seeds default company settings immediately
- responses are tenant-scoped by authenticated user `business_id`
- business logo is stored as `logo_file_id` from Appwrite Storage
- updates write `settings.company.updated` audit activity

### Phase 2.3 master data category APIs

Implemented protected APIs:

- `GET /api/v1/master-data/overview`
- `GET /api/v1/master-data/unit-categories`
- `GET /api/v1/master-data/units`
- `POST /api/v1/master-data/units`
- `GET /api/v1/master-data/units/:id`
- `PATCH /api/v1/master-data/units/:id`
- `PATCH /api/v1/master-data/units/:id/status`
- `DELETE /api/v1/master-data/units/:id`
- `GET /api/v1/master-data/order-statuses`
- `POST /api/v1/master-data/order-statuses`
- `PATCH /api/v1/master-data/order-statuses/:id`
- `PATCH /api/v1/master-data/order-statuses/:id/status`
- `GET /api/v1/master-data/payment-statuses`
- `POST /api/v1/master-data/payment-statuses`
- `PATCH /api/v1/master-data/payment-statuses/:id`
- `PATCH /api/v1/master-data/payment-statuses/:id/status`
- `GET /api/v1/products`
- `POST /api/v1/products`
- `GET /api/v1/products/:id`
- `PATCH /api/v1/products/:id`
- `PATCH /api/v1/products/:id/status`
- `DELETE /api/v1/products/:id`
- `GET /api/v1/products/pos`
- `GET /api/v1/products/lookup`
- `GET /api/v1/products/:productId/variants`
- `POST /api/v1/products/:productId/variants`
- `PATCH /api/v1/products/:productId/variants/:variantId`
- `PATCH /api/v1/products/:productId/variants/:variantId/status`
- `DELETE /api/v1/products/:productId/variants/:variantId`
- `GET /api/v1/master-data/product-categories`
- `POST /api/v1/master-data/product-categories`
- `GET /api/v1/master-data/product-categories/:id`
- `PATCH /api/v1/master-data/product-categories/:id`
- `PATCH /api/v1/master-data/product-categories/:id/status`
- `DELETE /api/v1/master-data/product-categories/:id`
- `GET /api/v1/master-data/ingredient-categories`
- `POST /api/v1/master-data/ingredient-categories`
- `GET /api/v1/master-data/ingredient-categories/:id`
- `PATCH /api/v1/master-data/ingredient-categories/:id`
- `PATCH /api/v1/master-data/ingredient-categories/:id/status`
- `DELETE /api/v1/master-data/ingredient-categories/:id`
- `GET /api/v1/master-data/packaging-categories`
- `POST /api/v1/master-data/packaging-categories`
- `GET /api/v1/master-data/packaging-categories/:id`
- `PATCH /api/v1/master-data/packaging-categories/:id`
- `PATCH /api/v1/master-data/packaging-categories/:id/status`
- `DELETE /api/v1/master-data/packaging-categories/:id`
- `GET /api/v1/master-data/supplier-categories`
- `POST /api/v1/master-data/supplier-categories`
- `GET /api/v1/master-data/supplier-categories/:id`
- `PATCH /api/v1/master-data/supplier-categories/:id`
- `PATCH /api/v1/master-data/supplier-categories/:id/status`
- `DELETE /api/v1/master-data/supplier-categories/:id`

Behavior:

- all records are scoped by authenticated user `business_id`
- protected by `master_data.view` and `master_data.manage`
- duplicate category names are blocked inside the same business
- product category codes are unique inside the same business
- product categories support parent/child hierarchy
- delete endpoints deactivate records instead of hard-deleting them
- create/update/status/delete actions write activity logs
- owner registration seeds default product, ingredient, packaging, and supplier categories

Unit behavior:

- system default units are global records with `business_id = NULL`
- custom units are scoped to the authenticated user's `business_id`
- system units cannot be modified, deactivated, or deleted by tenant users
- base unit conversion metadata supports examples like `g -> kg` and `ml -> ltr`
- conversion factors must be positive
- circular conversion references are blocked
- `GET /api/v1/master-data/overview` now returns `units_count`

### Phase 2.5 tax rate APIs

Implemented protected APIs:

- `GET /api/v1/settings/tax-rates`
- `POST /api/v1/settings/tax-rates`
- `GET /api/v1/settings/tax-rates/:id`
- `PATCH /api/v1/settings/tax-rates/:id`
- `PATCH /api/v1/settings/tax-rates/:id/status`
- `DELETE /api/v1/settings/tax-rates/:id`

Behavior:

- all tax rates are scoped by authenticated user `business_id`
- protected by `settings.view` and `settings.manage`
- tax type must be `VAT`, `GST`, `Sales Tax`, `Service Charge`, or `Custom`
- tax percentage must be between `0` and `100`
- only one default tax rate is allowed per business
- delete endpoints deactivate tax rates instead of hard-deleting them
- owner registration seeds `UAE VAT 5%`
- `GET /api/v1/settings/overview` now returns `active_tax_rates_count`

### Phase 2.6 payment method APIs

Implemented protected APIs:

- `GET /api/v1/settings/payment-methods`
- `POST /api/v1/settings/payment-methods`
- `GET /api/v1/settings/payment-methods/:id`
- `PATCH /api/v1/settings/payment-methods/:id`
- `PATCH /api/v1/settings/payment-methods/:id/status`
- `DELETE /api/v1/settings/payment-methods/:id`

Behavior:

- all payment methods are scoped by authenticated user `business_id`
- protected by `settings.view` and `settings.manage`
- method type must be `cash`, `card`, `bank_transfer`, `online`, `wallet`, or `custom`
- only one default payment method is allowed per business
- delete endpoints deactivate payment methods instead of hard-deleting them
- owner registration seeds `Cash`, `Card`, and `Bank Transfer`
- `GET /api/v1/settings/overview` now returns `active_payment_methods_count`

### Phase 2.7 workflow status APIs

Implemented protected APIs:

- `GET /api/v1/master-data/order-statuses`
- `POST /api/v1/master-data/order-statuses`
- `PATCH /api/v1/master-data/order-statuses/:id`
- `PATCH /api/v1/master-data/order-statuses/:id/status`
- `GET /api/v1/master-data/payment-statuses`
- `POST /api/v1/master-data/payment-statuses`
- `PATCH /api/v1/master-data/payment-statuses/:id`
- `PATCH /api/v1/master-data/payment-statuses/:id/status`

Behavior:

- system defaults use `business_id = NULL` and are visible to every business
- tenant custom statuses are scoped by authenticated user `business_id`
- system statuses cannot be modified or deactivated by tenant users
- order statuses support `sort_order` and `is_final_status`
- `GET /api/v1/master-data/overview` now returns `order_statuses_count` and `payment_statuses_count`

### Sprint 2.1 product APIs

Implemented protected APIs:

- `GET /api/v1/products`
- `POST /api/v1/products`
- `GET /api/v1/products/:id`
- `PATCH /api/v1/products/:id`
- `PATCH /api/v1/products/:id/status`
- `DELETE /api/v1/products/:id`
- `GET /api/v1/products/pos`
- `GET /api/v1/products/lookup`
- `GET /api/v1/products/:productId/variants`
- `POST /api/v1/products/:productId/variants`
- `PATCH /api/v1/products/:productId/variants/:variantId`
- `PATCH /api/v1/products/:productId/variants/:variantId/status`
- `DELETE /api/v1/products/:productId/variants/:variantId`

Behavior:

- all product records are scoped by authenticated user `business_id`
- protected by `products.view`, `products.manage`, and `pos.view` for POS list/lookup
- product code is unique per business and auto-generated as `PRD-000001` when omitted
- SKU and barcode are unique per business across products and variants
- category, unit, and tax rate references are validated before create/update
- delete endpoints soft-delete and archive records
- POS product list returns active, POS-visible products only
- lookup supports `barcode`, `sku`, or `product_code`
- product and variant images are stored as `image_file_id` from Appwrite Storage
- product and variant mutations write audit logs

### Sprint 2.2 POS billing APIs

Implemented protected APIs:

- `GET /api/v1/pos/products`
- `GET /api/v1/pos/products/lookup`
- `POST /api/v1/pos/held-sales`
- `GET /api/v1/pos/held-sales`
- `GET /api/v1/pos/held-sales/:id`
- `POST /api/v1/pos/held-sales/:id/resume`
- `DELETE /api/v1/pos/held-sales/:id`
- `POST /api/v1/pos/checkout`
- `GET /api/v1/pos/sales`
- `GET /api/v1/pos/sales/:id`
- `GET /api/v1/pos/sales/:id/receipt`
- `POST /api/v1/pos/sales/:id/refund`
- `POST /api/v1/pos/sales/:id/void`

Behavior:

- checkout is wrapped in a PostgreSQL transaction
- backend calculates subtotal, discounts, tax, total, paid amount, change, and payment status
- sale numbers are generated per business/date as `SALE-YYYYMMDD-000001`
- sale items snapshot product, variant, SKU, tax name, and tax percentage
- split payment is supported through multiple `payments`
- tax-inclusive and tax-exclusive tax rates are supported
- refunds support partial and full refund foundation
- void uses `pos.void` when assigned, with `pos.refund` accepted as fallback
- full inventory deduction is intentionally not implemented yet; checkout has a service placeholder

### Sprint 2.3 payment APIs

Implemented protected APIs:

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

Behavior:

- `sale_payments` now stores branch, method type snapshot, provider transaction ID, status, cashier, notes, and soft-delete metadata
- reference number is required when the selected payment method has `requires_reference = true`
- checkout and add-payment support split payments and partial payments
- cash overpayment is allowed and recorded as change; non-cash overpayment is rejected
- add-payment supports completing partial sales later and blocks voided or fully refunded sales
- payment refunds cannot exceed remaining refundable amount
- payment refunds are blocked for deleted payments, non-refundable statuses, voided sales, inactive payment methods, and over-refund attempts
- sale `paid_amount` and `payment_status` are recalculated from completed payments minus completed payment refunds after add-payment/refund
- sale payment status resolves as `unpaid`, `partial`, `paid`, or `refunded` from backend totals only
- daily and by-method summaries count completed payments and subtract completed refunds with optional branch/date filters
- reconciliation stores expected, counted, and difference amounts using calculated payment totals
- audit logs are written for `payment.added`, `payment.refunded`, `payment.summary.viewed`, and `reconciliation.created`
- no online gateway integration is included yet

### POS held sales APIs

Implemented protected APIs:

- `POST /api/v1/pos/held-sales`
- `GET /api/v1/pos/held-sales`
- `GET /api/v1/pos/held-sales/:id`
- `POST /api/v1/pos/held-sales/:id/resume`
- `DELETE /api/v1/pos/held-sales/:id`

Behavior:

- held sale is a saved cart, not a completed sale
- held sales do not create payments, revenue, inventory deduction, or sales report totals
- backend snapshots product, variant, SKU, tax, discount, and estimated totals
- `resume` marks the held sale as resumed and returns cart data for the frontend
- `cancel` marks the held sale as cancelled
- list defaults to active `held` records and supports `status`, `branch_id`, `cashier_user_id`, `search`, `page`, and `limit`

### Sprint 2.4 customer APIs

Implemented protected APIs:

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
- `GET /api/v1/customers/:id/notes`
- `POST /api/v1/customers/:id/notes`
- `DELETE /api/v1/customers/:id/notes/:noteId`
- `GET /api/v1/customers/:id/tags`
- `POST /api/v1/customers/:id/tags`
- `DELETE /api/v1/customers/:id/tags/:tagId`
- `GET /api/v1/customers/:id/stats`

Behavior:

- customers are tenant-scoped by authenticated user `business_id`
- protected by `customers.view` and `customers.manage`, with temporary fallback to `pos.view` and `pos.sell`
- customer code is auto-generated per business as `CUST-000001`
- full create requires `full_name` plus phone or email
- phone and email are unique per business when provided
- lookup returns active customers only, supports phone/email/search, and limits results to 10 by default or 20 maximum
- quick-create is intended for POS customer selection and returns an existing active customer if phone/email already exists
- quick-create rejects blocked existing customers and prevents duplicate active customer records
- inactive, blocked, and deleted customers cannot be selected in POS checkout
- tags support create/update/delete plus customer attach/remove operations
- notes are soft-deleted and limited to 1000 characters
- stats are derived from sales, sale payments, payment refunds, and sale refunds
- receipt and sale details include customer name and phone when a customer is linked
- delete is soft-delete only

### Sprint 3.1 inventory APIs

Implemented protected APIs:

- `GET /api/v1/inventory`
- `GET /api/v1/inventory/:id`
- `POST /api/v1/inventory/opening-stock`
- `GET /api/v1/inventory/stock-locations`
- `POST /api/v1/inventory/stock-locations`
- `GET /api/v1/inventory/stock-locations/:locationId`
- `PATCH /api/v1/inventory/stock-locations/:locationId`
- `PATCH /api/v1/inventory/stock-locations/:locationId/status`
- `PATCH /api/v1/inventory/stock-locations/:locationId/default`
- `DELETE /api/v1/inventory/stock-locations/:locationId`
- `GET /api/v1/inventory/location-balances`
- `GET /api/v1/inventory/:id/location-balances`
- `GET /api/v1/inventory/stock-transfers`
- `POST /api/v1/inventory/stock-transfers`
- `GET /api/v1/inventory/stock-transfers/:transferId`
- `POST /api/v1/inventory/stock-transfers/:transferId/complete`
- `POST /api/v1/inventory/stock-transfers/:transferId/cancel`
- `POST /api/v1/inventory/:id/adjust`
- `GET /api/v1/inventory/:id/movements`
- `GET /api/v1/inventory/movements`
- `GET /api/v1/inventory/low-stock`
- `GET /api/v1/inventory/expiry-alerts`
- `GET /api/v1/inventory/:id/expiry-batches`
- `POST /api/v1/inventory/:id/expiry-batches`
- `PATCH /api/v1/inventory/expiry-batches/:batchId`
- `PATCH /api/v1/inventory/expiry-batches/:batchId/status`

Behavior:

- inventory is tenant-scoped by authenticated user `business_id`
- protected by `inventory.view` and `inventory.manage`
- stock is tracked per business, branch, item type, item ID, and optional product variant
- product inventory is fully validated against existing products, branches, and units
- product variants can be tracked as separate inventory rows with `item_type = product_variant`, `product_id`, and `product_variant_id`
- inventory list supports `include_uninitialized=true` to include stock-tracked catalog products, variants, ingredients, and packaging items that do not have an inventory row yet
- uninitialized inventory rows return zero quantities, `inventory_status = not_initialized`, and `can_add_opening_stock = true`
- POS checkout deducts variant inventory when `product_variant_id` is provided; otherwise it deducts parent product inventory
- ingredient inventory IDs are schema-ready for a future ingredients module; packaging inventory IDs now link to Sprint 4.1 packaging items
- every stock change creates a `stock_movements` record
- stock locations track physical areas inside a branch, such as Kitchen, Store Room, Front Desk, Display Counter, or Main Stock
- every branch gets a default `Main Stock` location from migration backfill
- opening stock accepts optional `stock_location_id`; if omitted, backend uses the branch default location
- location balances show the branch inventory breakdown by `Branch + Location + Item`, including variant rows such as `Orange Mocktail - Small`
- stock transfers move quantity between two locations in the same branch without changing the branch-level inventory total
- transfer completion writes a `transfer` stock movement with `from_stock_location_id` and `to_stock_location_id`
- opening stock creates or increments an inventory item and writes an `opening_stock` movement
- manual adjustment supports `increase` and `decrease`, and prevents negative stock
- `available_quantity` is maintained as `current_quantity - reserved_quantity`
- low-stock alerts return items where `available_quantity <= reorder_level`
- expiry batches are allowed only for expiry-tracked inventory items
- sale deduction is intentionally left as a service hook: `InventoryService.DeductOnSale(saleID)`

### Sprint 3.2 stock movement APIs

Implemented protected APIs:

- `GET /api/v1/stock-movements`
- `GET /api/v1/stock-movements/:id`
- `GET /api/v1/stock-movements/inventory/:inventoryItemId`
- `POST /api/v1/stock-movements/manual`
- `POST /api/v1/stock-movements/:id/reverse`
- `GET /api/v1/stock-movements/summary`
- `GET /api/v1/stock-movements/audit/:inventoryItemId`

Behavior:

- stock movements are the inventory ledger for every quantity change
- protected by `inventory.view` and `inventory.manage`
- manual movement supports `adjustment_in`, `adjustment_out`, `wastage`, and `return_in`
- movement reversal creates a compensating movement instead of deleting history
- reversal is currently allowed for `opening_stock`, `adjustment_in`, `adjustment_out`, `wastage`, and `return_in`
- sale and purchase movement reversal are intentionally blocked until those flows are period-safe
- movement summary groups totals by direction and movement type
- inventory audit compares `inventory_items.current_quantity` against the movement ledger

### Sprint 3.3 supplier APIs

Implemented protected APIs:

- `GET /api/v1/suppliers`
- `POST /api/v1/suppliers`
- `GET /api/v1/suppliers/lookup`
- `GET /api/v1/suppliers/:id`
- `PATCH /api/v1/suppliers/:id`
- `PATCH /api/v1/suppliers/:id/status`
- `DELETE /api/v1/suppliers/:id`
- `GET /api/v1/suppliers/:id/contacts`
- `POST /api/v1/suppliers/:id/contacts`
- `PATCH /api/v1/suppliers/:id/contacts/:contactId`
- `DELETE /api/v1/suppliers/:id/contacts/:contactId`
- `GET /api/v1/suppliers/:id/notes`
- `POST /api/v1/suppliers/:id/notes`
- `DELETE /api/v1/suppliers/:id/notes/:noteId`
- `GET /api/v1/suppliers/:id/stats`

Behavior:

- suppliers are tenant-scoped by authenticated user `business_id`
- protected by `suppliers.view` and `suppliers.manage`, with fallback to `inventory.view` and `inventory.manage`
- supplier code is auto-generated per business as `SUP-000001`
- supplier category is validated against current business supplier categories
- contacts support one primary contact per supplier
- supplier lookup returns active suppliers for future purchasing flows
- supplier stats currently return procurement-ready placeholder totals until purchasing is built
- delete is soft-delete only

### Sprint 3.4 purchasing APIs

Implemented protected APIs:

- `GET /api/v1/purchasing/orders`
- `POST /api/v1/purchasing/orders`
- `GET /api/v1/purchasing/orders/:id`
- `PATCH /api/v1/purchasing/orders/:id`
- `PATCH /api/v1/purchasing/orders/:id/status`
- `DELETE /api/v1/purchasing/orders/:id`
- `GET /api/v1/purchasing/invoices`
- `POST /api/v1/purchasing/invoices`
- `GET /api/v1/purchasing/invoices/:id`
- `PATCH /api/v1/purchasing/invoices/:id`
- `POST /api/v1/purchasing/invoices/:id/post`
- `POST /api/v1/purchasing/invoices/:id/cancel`
- `POST /api/v1/purchasing/receive`
- `GET /api/v1/purchasing/receipts`
- `GET /api/v1/purchasing/receipts/:id`
- `POST /api/v1/purchasing/receipts/:id/post`
- `POST /api/v1/purchasing/receipts/:id/cancel`
- `GET /api/v1/purchasing/summary`
- `GET /api/v1/purchasing/supplier/:supplierId/history`

Behavior:

- protected by `purchasing.view` and `purchasing.manage`, with fallback to `inventory.view` and `inventory.manage`
- purchase order numbers auto-generate per business as `PO-000001`
- purchase receipt numbers auto-generate per business as `PR-000001`
- supplier and branch are validated against the authenticated business
- product purchase lines validate real products; packaging lines validate Sprint 4.1 packaging items; ingredient IDs remain UUID placeholders until the ingredients module exists
- invoices are created as draft, can be posted, and posted invoices can be used for receiving
- receiving creates inventory items when missing and applies `purchase_in` stock movements
- receiving with expiry dates creates expiry batches
- receipt cancellation creates compensating stock-out reversal movements
- purchasing summary and supplier history are available for frontend dashboards

### Sprint 4.1 packaging APIs

Implemented protected APIs:

- `GET /api/v1/packaging`
- `POST /api/v1/packaging`
- `GET /api/v1/packaging/lookup`
- `GET /api/v1/packaging/:id`
- `PATCH /api/v1/packaging/:id`
- `PATCH /api/v1/packaging/:id/status`
- `DELETE /api/v1/packaging/:id`
- `GET /api/v1/packaging/product/:productId`
- `POST /api/v1/packaging/product/:productId`
- `DELETE /api/v1/packaging/product/:productId/:ruleId`

Behavior:

- protected by `master_data.view` and `master_data.manage`
- packaging code is auto-generated per business as `PKG-000001`
- packaging category, supplier, unit, and product references are tenant validated
- image references use `image_file_id` for Appwrite Storage consistency
- stock-tracked packaging automatically creates a zero-quantity `inventory_items` record for the business default/first active branch
- packaging inventory rows use `item_type = packaging` and now display packaging names in inventory
- product usage rules prevent duplicate product + packaging combinations
- only one default packaging rule is allowed per product
- deletion is soft-delete and blocked if the packaging item is used in product packaging rules
- purchasing packaging lines now validate real packaging items instead of accepting placeholder UUIDs

### Sprint 4.2 recipes / BOM APIs

Implemented protected APIs:

- `GET /api/v1/recipes`
- `POST /api/v1/recipes`
- `GET /api/v1/recipes/lookup`
- `GET /api/v1/recipes/product/:productId`
- `GET /api/v1/recipes/:id`
- `PATCH /api/v1/recipes/:id`
- `PATCH /api/v1/recipes/:id/status`
- `DELETE /api/v1/recipes/:id`
- `GET /api/v1/recipes/:id/ingredients`
- `POST /api/v1/recipes/:id/ingredients`
- `PATCH /api/v1/recipes/:id/ingredients/:ingredientLineId`
- `DELETE /api/v1/recipes/:id/ingredients/:ingredientLineId`
- `GET /api/v1/recipes/:id/packaging`
- `POST /api/v1/recipes/:id/packaging`
- `PATCH /api/v1/recipes/:id/packaging/:packagingLineId`
- `DELETE /api/v1/recipes/:id/packaging/:packagingLineId`
- `GET /api/v1/recipes/:id/cost`
- `POST /api/v1/recipes/:id/recalculate-cost`
- `GET /api/v1/recipes/:id/versions`
- `POST /api/v1/recipes/:id/create-version`

Behavior:

- protected by `recipes.view` and `recipes.manage`, with fallback to `products.view` and `products.manage`
- recipe code is auto-generated per business as `RCP-000001`
- recipes can be created only for `manufactured` or `made_to_order` products
- only one active recipe is allowed per product
- ingredient lines support `inventory_item_id` now and keep `ingredient_id` as a future ingredient-module hook
- packaging lines use real `packaging_items`
- recipe costs are calculated by the backend from ingredient and packaging lines
- line costs use same-unit validation until full cross-unit conversion is wired into recipe costing
- recipe updates and manual version creation store JSON snapshots in `recipe_versions`
- create/update/status/line/cost/version actions write activity logs

### Sprint 4.3 manufacturing APIs

Implemented protected APIs:

- `GET /api/v1/manufacturing/batches`
- `POST /api/v1/manufacturing/batches`
- `GET /api/v1/manufacturing/batches/:id`
- `PATCH /api/v1/manufacturing/batches/:id`
- `POST /api/v1/manufacturing/batches/:id/start`
- `POST /api/v1/manufacturing/batches/:id/complete`
- `POST /api/v1/manufacturing/batches/:id/cancel`
- `GET /api/v1/manufacturing/batches/:id/ingredients`
- `PATCH /api/v1/manufacturing/batches/:id/ingredients/:lineId`
- `GET /api/v1/manufacturing/batches/:id/packaging`
- `PATCH /api/v1/manufacturing/batches/:id/packaging/:lineId`
- `GET /api/v1/manufacturing/summary`
- `GET /api/v1/manufacturing/product/:productId/history`

Behavior:

- protected by `manufacturing.view` and `manufacturing.manage`, with fallback to `inventory.view` and `inventory.manage`
- production batch numbers are auto-generated per business as `MFG-000001`
- batches are created from active recipes only
- creation calculates planned ingredient and packaging consumption from recipe yield ratio
- stock is not deducted on create; stock moves only when completing production
- completion consumes ingredients and packaging with `production_out` stock movements
- completion creates finished product stock with a `production_in` stock movement
- expiry batch output is created when `expiry_date` is provided
- completion is transaction-safe; if any stock movement fails, the full production completion rolls back
- production summary and product manufacturing history are available for dashboards
- create/update/start/complete/cancel/consumption update actions write activity logs

### Sprint 4.4 ingredient APIs

Implemented protected APIs:

- `GET /api/v1/ingredients`
- `POST /api/v1/ingredients`
- `GET /api/v1/ingredients/lookup`
- `GET /api/v1/ingredients/:id`
- `PATCH /api/v1/ingredients/:id`
- `PATCH /api/v1/ingredients/:id/status`
- `DELETE /api/v1/ingredients/:id`

Behavior:

- protected by `master_data.view` and `master_data.manage`
- ingredient code is auto-generated per business as `ING-000001`
- ingredient names and codes are unique inside the same business
- ingredient category, supplier, and unit references are tenant validated
- image references use `image_file_id` for Appwrite Storage consistency
- stock-tracked ingredients automatically create a zero-quantity `inventory_items` record for the business default/first active branch
- ingredient inventory rows use `item_type = ingredient` and now display real ingredient names/codes in inventory and stock movement screens
- recipes can use `ingredient_id` directly or `inventory_item_id`
- purchasing ingredient lines now validate real ingredients instead of accepting placeholder UUIDs
- delete is soft-delete, but linked inventory/recipe records block deletion; use inactive status instead

### Sprint 4.4 bakery order APIs

Implemented protected APIs:

- `GET /api/v1/bakery-orders`
- `POST /api/v1/bakery-orders`
- `GET /api/v1/bakery-orders/summary`
- `GET /api/v1/bakery-orders/:id`
- `PATCH /api/v1/bakery-orders/:id`
- `PATCH /api/v1/bakery-orders/:id/status`
- `DELETE /api/v1/bakery-orders/:id`
- `POST /api/v1/bakery-orders/:id/items`
- `PATCH /api/v1/bakery-orders/:id/items/:itemId`
- `DELETE /api/v1/bakery-orders/:id/items/:itemId`
- `GET /api/v1/bakery-orders/:id/payments`
- `POST /api/v1/bakery-orders/:id/payments`
- `POST /api/v1/bakery-orders/:id/assign-production`
- `PATCH /api/v1/bakery-orders/:id/production-status`
- `GET /api/v1/bakery-orders/:id/packaging`
- `POST /api/v1/bakery-orders/:id/packaging`

Behavior:

- protected by `orders.view` and `orders.manage`, with fallback to `pos.view` and `pos.sell`
- order numbers are auto-generated per business as `ORD-000001`
- supports pickup and delivery order scheduling with event date and time fields
- order item totals, tax, balance, and payment status are calculated by the backend
- custom fields cover weight, flavor, design notes, message text, and flexible JSON customizations
- deposit, balance, and full payment records update `paid_amount`, `balance_amount`, and `payment_status`
- order status follows `new -> confirmed -> in_production -> ready -> delivered -> completed`; any active order can move to `cancelled`
- production batch assignment and production status linkage are available as a foundation
- packaging items can be attached to orders for future deduction on fulfillment
- create/update/status/payment/production/packaging actions write activity logs

### Phase 0.8.1 Basic role listing

Implemented protected API:

- `GET /api/v1/roles`

Behavior:

- returns business roles for the current tenant
- also returns system roles where `business_id IS NULL`
- protected by `roles.view`

### Phase 0.8.2 Basic role creation

Implemented protected API:

- `POST /api/v1/roles`

Behavior:

- creates a tenant-scoped role for the current business
- validates permission keys against the permissions table
- attaches selected permissions to the new role in one transaction
- protected by `roles.manage`

### Phase 0.8.3 Basic role update

Implemented protected API:

- `PATCH /api/v1/roles/:id`

Behavior:

- updates tenant role name and description
- replaces assigned permissions if `permission_keys` is provided
- blocks editing system roles
- protected by `roles.manage`

### Phase 0.8.4 Basic role deletion

Implemented protected API:

- `DELETE /api/v1/roles/:id`

Behavior:

- deletes tenant roles only
- blocks deleting system roles
- blocks deleting roles that are still assigned to users
- protected by `roles.manage`

### Phase 0.8.5 Dedicated role-permission endpoints

Implemented protected APIs:

- `GET /api/v1/roles/:id/permissions`
- `PATCH /api/v1/roles/:id/permissions`

Behavior:

- fetches the current permission set for a role
- replaces the permission set for tenant roles
- blocks updating system role permissions
- validates permission keys against the permissions table

### Phase 0.9 Default permission seeding

Seeded permission keys:

- `users.view`
- `users.create`
- `users.edit`
- `users.delete`
- `roles.view`
- `roles.manage`
- `branches.view`
- `branches.manage`
- `settings.view`
- `settings.manage`
- `master_data.view`
- `master_data.manage`
- `pos.view`
- `pos.sell`
- `pos.refund`
- `pos.void`
- `payments.view`
- `payments.manage`
- `payments.refund`
- `payments.reconcile`
- `customers.view`
- `customers.manage`
- `products.view`
- `products.manage`
- `orders.view`
- `orders.manage`
- `inventory.view`
- `inventory.manage`
- `suppliers.view`
- `suppliers.manage`
- `purchasing.view`
- `purchasing.manage`
- `recipes.view`
- `recipes.manage`
- `manufacturing.view`
- `manufacturing.manage`
- `reports.view`

### Phase 0.9.1 Permission listing endpoint

Implemented protected API:

- `GET /api/v1/permissions`

Behavior:

- returns the permission catalog for frontend role forms
- includes `module_name`, `permission_key`, and description
- protected route

### Phase 0.10 Testing assets

Added:

- curl examples
- success and failure response examples
- Postman collection: [Pastries_POS_Phase0.postman_collection.json](C:/Users/webde/Desktop/DMD_PRJ/Pastries_POS/backend/docs/postman/Pastries_POS_Phase0.postman_collection.json)

## What Has Been Verified

Verified during implementation:

- `go mod tidy`
- `gofmt`
- `go build ./...`
- backend starts successfully with local PostgreSQL
- `POST /api/v1/auth/register-owner` works end-to-end against local backend

Verified `register-owner` outcome:

- business record created
- Appwrite user created
- default roles created
- permissions seeded
- role permissions linked
- local user created
- trial subscription created
- audit log created

Not yet fully verified end-to-end:

- `login-sync` with a real frontend-issued Appwrite JWT in your current frontend flow
- `/api/v1/auth/me` using a verified frontend JWT
- full staff user creation flow through frontend

## Project Structure

```text
cmd/api/main.go

internal/
  config/
  database/
  server/
  middleware/
  modules/
    auth/
    users/
    businesses/
    roles/
    permissions/
    subscriptions/
    audit/
  shared/
    response/
    errors/
    utils/

migrations/
Dockerfile
docker-compose.yml
.env.example
```

## Architecture Rules

- handlers only receive and return HTTP data
- services contain business logic
- repositories contain GORM queries
- no database logic inside handlers
- tenant isolation is enforced with `business_id`
- transactions are used for owner registration

## Environment

Copy `.env.example` to `.env` and set real values.

Required Appwrite values:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`

Optional auth hardening:

```env
REQUIRE_EMAIL_VERIFICATION=false
PASSWORD_RESET_URL=http://localhost:3000/reset-password
```

Set this to `true` in production when Appwrite email verification is configured and users must verify email before using protected backend routes.

`PASSWORD_RESET_URL` is the frontend page Appwrite redirects users to after they click the password recovery email link.

Database configuration supports either of these styles.

### Option 1: `DATABASE_URL`

```env
DATABASE_URL=postgresql://username:password@host:5432/database_name?sslmode=require
```

### Option 2: split PostgreSQL values

```env
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=pastries_pos
POSTGRES_SSLMODE=disable
POSTGRES_TIMEZONE=UTC
```

Backend behavior:

- `DATABASE_URL` is used first if present
- otherwise the app uses `POSTGRES_*`

Important:

- never commit real credentials into `.env.example`
- never put `APPWRITE_API_KEY` in frontend code
- URL-encode special characters if using `DATABASE_URL`

## Local Development

### Run with local PostgreSQL

Recommended beginner setup:

1. install PostgreSQL locally
2. create database `pastries_pos`
3. update `.env` to use `127.0.0.1`
4. run migrations:

```bash
go run ./cmd/migrate
```

5. run:

```bash
go run ./cmd/api
```

Test:

```bash
curl http://localhost:8080/health
```

### Run with Docker Compose

If Docker is installed, you can run:

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `localhost:5432`
- API on `localhost:8080`

Useful commands:

```bash
docker compose down
docker compose down -v
docker compose logs -f api
docker compose logs -f postgres
```

## Migrations

Runtime `gorm.AutoMigrate` is disabled. Schema changes are handled by SQL files in `migrations/`.

The Docker image builds two binaries:

- `/app/migrate`
- `/app/api`

The production container command runs:

```bash
/app/migrate && /app/api
```

This means Dockploy redeploys apply pending migrations automatically before the API starts. Applied migrations are tracked in the `schema_migrations` table.

For local development:

```bash
go run ./cmd/migrate
go run ./cmd/api
```

For beginner/local convenience, you can also enable API startup migrations:

```env
AUTO_RUN_MIGRATIONS=true
MIGRATIONS_PATH=migrations
```

Then this is enough:

```bash
go run ./cmd/api
```

If you need a custom migration path:

```bash
MIGRATIONS_PATH=migrations go run ./cmd/migrate
```

## API Summary

### Public routes

- `GET /health`
- `POST /api/v1/auth/register-owner`
- `POST /api/v1/auth/login-sync`
- `POST /api/v1/auth/accept-invitation`
- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/complete`

### Protected routes

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout-sync`
- `POST /api/v1/auth/switch-branch`
- `GET /api/v1/activity-logs`
- `GET /api/v1/business`
- `PATCH /api/v1/business`
- `GET /api/v1/business/onboarding-status`
- `GET /api/v1/settings`
- `PATCH /api/v1/settings`
- `GET /api/v1/settings/company`
- `PATCH /api/v1/settings/company`
- `GET /api/v1/settings/overview`
- `GET /api/v1/settings/tax-rates`
- `POST /api/v1/settings/tax-rates`
- `GET /api/v1/settings/tax-rates/:id`
- `PATCH /api/v1/settings/tax-rates/:id`
- `PATCH /api/v1/settings/tax-rates/:id/status`
- `DELETE /api/v1/settings/tax-rates/:id`
- `GET /api/v1/settings/payment-methods`
- `POST /api/v1/settings/payment-methods`
- `GET /api/v1/settings/payment-methods/:id`
- `PATCH /api/v1/settings/payment-methods/:id`
- `PATCH /api/v1/settings/payment-methods/:id/status`
- `DELETE /api/v1/settings/payment-methods/:id`
- `GET /api/v1/pos/products`
- `GET /api/v1/pos/products/lookup`
- `POST /api/v1/pos/checkout`
- `GET /api/v1/pos/sales`
- `GET /api/v1/pos/sales/:id`
- `GET /api/v1/pos/sales/:id/receipt`
- `POST /api/v1/pos/sales/:id/refund`
- `POST /api/v1/pos/sales/:id/void`
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
- `GET /api/v1/customers/:id/notes`
- `POST /api/v1/customers/:id/notes`
- `DELETE /api/v1/customers/:id/notes/:noteId`
- `GET /api/v1/customers/:id/tags`
- `POST /api/v1/customers/:id/tags`
- `DELETE /api/v1/customers/:id/tags/:tagId`
- `GET /api/v1/customers/:id/stats`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `POST /api/v1/users/invite`
- `POST /api/v1/users/invitations`
- `GET /api/v1/users/invitations`
- `POST /api/v1/users/invitations/:id/resend`
- `PATCH /api/v1/users/invitations/:id/cancel`
- `GET /api/v1/users/:id`
- `GET /api/v1/users/:id/activity`
- `PATCH /api/v1/users/:id`
- `PATCH /api/v1/users/:id/branch`
- `PATCH /api/v1/users/:id/status`
- `DELETE /api/v1/users/:id`
- `PATCH /api/v1/users/:id/restore`
- `GET /api/v1/branches`
- `POST /api/v1/branches`
- `GET /api/v1/branches/:id`
- `PATCH /api/v1/branches/:id`
- `PATCH /api/v1/branches/:id/status`
- `GET /api/v1/master-data/overview`
- `GET /api/v1/master-data/unit-categories`
- `GET /api/v1/master-data/units`
- `POST /api/v1/master-data/units`
- `GET /api/v1/master-data/units/:id`
- `PATCH /api/v1/master-data/units/:id`
- `PATCH /api/v1/master-data/units/:id/status`
- `DELETE /api/v1/master-data/units/:id`
- `GET /api/v1/master-data/product-categories`
- `POST /api/v1/master-data/product-categories`
- `GET /api/v1/master-data/product-categories/:id`
- `PATCH /api/v1/master-data/product-categories/:id`
- `PATCH /api/v1/master-data/product-categories/:id/status`
- `DELETE /api/v1/master-data/product-categories/:id`
- `GET /api/v1/master-data/ingredient-categories`
- `POST /api/v1/master-data/ingredient-categories`
- `GET /api/v1/master-data/ingredient-categories/:id`
- `PATCH /api/v1/master-data/ingredient-categories/:id`
- `PATCH /api/v1/master-data/ingredient-categories/:id/status`
- `DELETE /api/v1/master-data/ingredient-categories/:id`
- `GET /api/v1/master-data/packaging-categories`
- `POST /api/v1/master-data/packaging-categories`
- `GET /api/v1/master-data/packaging-categories/:id`
- `PATCH /api/v1/master-data/packaging-categories/:id`
- `PATCH /api/v1/master-data/packaging-categories/:id/status`
- `DELETE /api/v1/master-data/packaging-categories/:id`
- `GET /api/v1/master-data/supplier-categories`
- `POST /api/v1/master-data/supplier-categories`
- `GET /api/v1/master-data/supplier-categories/:id`
- `PATCH /api/v1/master-data/supplier-categories/:id`
- `PATCH /api/v1/master-data/supplier-categories/:id/status`
- `DELETE /api/v1/master-data/supplier-categories/:id`
- `GET /api/v1/roles`
- `POST /api/v1/roles`
- `PATCH /api/v1/roles/:id`
- `DELETE /api/v1/roles/:id`
- `GET /api/v1/roles/:id/permissions`
- `PATCH /api/v1/roles/:id/permissions`
- `GET /api/v1/permissions`

## Example Requests

### Register owner

```bash
curl -X POST http://localhost:8080/api/v1/auth/register-owner \
  -H "Content-Type: application/json" \
  -d '{
    "full_name":"Owner Admin",
    "business_name":"Golden Crust Bakery",
    "email":"owner@example.com",
    "phone":"+971500000000",
    "password":"StrongPass123",
    "confirm_password":"StrongPass123"
  }'
```

### Login sync

```bash
curl -X POST http://localhost:8080/api/v1/auth/login-sync \
  -H "Content-Type: application/json" \
  -d '{
    "jwt":"appwrite_jwt_here"
  }'
```

### Current user

```bash
curl http://localhost:8080/api/v1/auth/me \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Logout sync

```bash
curl -X POST http://localhost:8080/api/v1/auth/logout-sync \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Business profile

```bash
curl http://localhost:8080/api/v1/business \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Onboarding status

```bash
curl http://localhost:8080/api/v1/business/onboarding-status \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Business settings

```bash
curl http://localhost:8080/api/v1/settings \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Switch current branch

```bash
curl -X POST http://localhost:8080/api/v1/auth/switch-branch \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here"
  }'
```

### Request password reset

```bash
curl -X POST http://localhost:8080/api/v1/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{
    "email":"owner@example.com"
  }'
```

### Complete password reset

```bash
curl -X POST http://localhost:8080/api/v1/auth/password-reset/complete \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"appwrite_user_id_from_recovery_link",
    "secret":"secret_from_recovery_link",
    "password":"NewStrongPass123",
    "confirm_password":"NewStrongPass123"
  }'
```

### Create branch

```bash
curl -X POST http://localhost:8080/api/v1/branches \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_name":"Main Branch",
    "code":"MAIN",
    "address":"Dubai",
    "phone":"+971500000000"
  }'
```

### Invite staff user

```bash
curl -X POST http://localhost:8080/api/v1/users/invite \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name":"Cashier User",
    "email":"cashier@example.com",
    "phone":"+971500000001",
    "role_id":"role_uuid_here",
    "branch_id":"branch_uuid_here",
    "avatar_file_id":"appwrite_avatar_file_id_here"
  }'
```

### Delete staff user

```bash
curl -X DELETE http://localhost:8080/api/v1/users/{id} \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### User activity

```bash
curl http://localhost:8080/api/v1/users/{id}/activity \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### POS products

```bash
curl "http://localhost:8080/api/v1/pos/products?search=cake&page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### POS barcode lookup

```bash
curl "http://localhost:8080/api/v1/pos/products/lookup?barcode=629000000001" \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### POS checkout

```bash
curl -X POST http://localhost:8080/api/v1/pos/checkout \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "items":[
      {
        "product_id":"product_uuid_here",
        "product_variant_id":"variant_uuid_optional",
        "quantity":2,
        "discount_type":"percentage",
        "discount_value":10
      }
    ],
    "sale_discount_type":"fixed",
    "sale_discount_value":5,
    "payments":[
      {
        "payment_method_id":"cash_method_uuid_here",
        "amount":100
      },
      {
        "payment_method_id":"card_method_uuid_here",
        "amount":50,
        "reference_number":"CARD-REF-001"
      }
    ],
    "notes":"optional"
  }'
```

### POS Held Sales

```bash
curl -X POST http://localhost:8080/api/v1/pos/held-sales \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "items":[
      {
        "product_id":"product_uuid_here",
        "product_variant_id":"variant_uuid_optional",
        "quantity":2,
        "discount_type":"percentage",
        "discount_value":10
      }
    ],
    "notes":"Customer will come back"
  }'

curl "http://localhost:8080/api/v1/pos/held-sales?status=held&page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/pos/held-sales/{id} \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/pos/held-sales/{id}/resume \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X DELETE http://localhost:8080/api/v1/pos/held-sales/{id} \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### POS sales and receipt

```bash
curl "http://localhost:8080/api/v1/pos/sales?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/pos/sales/{id}/receipt \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### POS refund and void

```bash
curl -X POST http://localhost:8080/api/v1/pos/sales/{id}/refund \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"refund_amount":120,"reason":"Customer returned item"}'

curl -X POST http://localhost:8080/api/v1/pos/sales/{id}/void \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Wrong billing"}'
```

### Payments

```bash
curl "http://localhost:8080/api/v1/payments?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/payments/sale/{saleId} \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/payments/sale/{saleId}/add-payment \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method_id":"payment_method_uuid_here",
    "amount":50,
    "reference_number":"CARD-REF-001",
    "provider_transaction_id":"gateway_id_optional",
    "notes":"remaining balance payment"
  }'
```

### Payment Refunds

```bash
curl -X POST http://localhost:8080/api/v1/payments/{paymentId}/refund \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "refund_amount":25,
    "refund_reason":"Customer refund"
  }'

curl "http://localhost:8080/api/v1/payments/refunds?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Payment Summaries And Reconciliation

```bash
curl "http://localhost:8080/api/v1/payments/summary/daily?date=2026-05-02" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl "http://localhost:8080/api/v1/payments/summary/by-method?date_from=2026-05-01&date_to=2026-05-02" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl "http://localhost:8080/api/v1/payments/summary/daily?date=2026-05-02&branch_id=branch_uuid_here" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/payments/reconciliations \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "reconciliation_date":"2026-05-02",
    "payment_method_id":"payment_method_uuid_here",
    "counted_amount":500,
    "notes":"cash drawer counted"
  }'
```

### Customers

```bash
curl -X POST http://localhost:8080/api/v1/customers \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name":"John Doe",
    "phone":"971500000000",
    "email":"john@example.com",
    "gender":"male",
    "country":"UAE",
    "notes":"VIP customer"
  }'

curl "http://localhost:8080/api/v1/customers?search=john&page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl "http://localhost:8080/api/v1/customers/lookup?phone=97150" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/customers/quick-create \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Walk-in Customer","phone":"971511111111"}'

curl -X POST http://localhost:8080/api/v1/customers/tags \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"tag_name":"VIP","color":"#B8895B"}'

curl http://localhost:8080/api/v1/customers/{id}/tags \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/customers/{id}/tags \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"tag_id":"tag_uuid_here"}'

curl -X DELETE http://localhost:8080/api/v1/customers/{id}/tags/{tagId} \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/customers/{id}/notes \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"note":"Prefers less sugar cakes"}'

curl http://localhost:8080/api/v1/customers/{id}/stats \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Inventory

```bash
curl "http://localhost:8080/api/v1/inventory?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/inventory/opening-stock \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "item_type":"product",
    "product_id":"product_uuid_here",
    "unit_id":"unit_uuid_here",
    "quantity":25,
    "reorder_level":5,
    "is_expiry_tracked":true,
    "expiry_date":"2026-06-01",
    "reason":"Initial stock"
  }'

curl -X POST http://localhost:8080/api/v1/inventory/opening-stock \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "item_type":"product_variant",
    "product_id":"product_uuid_here",
    "product_variant_id":"variant_uuid_here",
    "stock_location_id":"location_uuid_here",
    "unit_id":"unit_uuid_here",
    "quantity":30,
    "reorder_level":5,
    "is_expiry_tracked":false,
    "reason":"Initial variant stock"
  }'

curl -X POST http://localhost:8080/api/v1/inventory/{id}/adjust \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"adjustment_type":"increase","quantity":5,"reason":"Manual correction"}'

curl http://localhost:8080/api/v1/inventory/{id}/movements \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/inventory/low-stock \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/inventory/{id}/expiry-batches \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number":"BATCH-001",
    "quantity":10,
    "received_date":"2026-05-04",
    "expiry_date":"2026-05-20"
  }'

curl "http://localhost:8080/api/v1/inventory/expiry-alerts?days=7" \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Stock Movements

```bash
curl "http://localhost:8080/api/v1/stock-movements?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl "http://localhost:8080/api/v1/stock-movements?movement_type=adjustment_in" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/stock-movements/{id} \
  -H "Authorization: Bearer appwrite_jwt_here"

curl "http://localhost:8080/api/v1/stock-movements/inventory/{inventoryItemId}?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/stock-movements/manual \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "inventory_item_id":"inventory_item_uuid_here",
    "movement_type":"adjustment_in",
    "quantity":5,
    "reason":"Manual correction",
    "notes":"optional note"
  }'

curl -X POST http://localhost:8080/api/v1/stock-movements/{id}/reverse \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Wrong stock entry"}'

curl "http://localhost:8080/api/v1/stock-movements/summary?date_from=2026-05-01&date_to=2026-05-05" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/stock-movements/audit/{inventoryItemId} \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Suppliers

```bash
curl "http://localhost:8080/api/v1/suppliers?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/suppliers \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_name":"ABC Trading LLC",
    "supplier_category_id":"supplier_category_uuid_optional",
    "phone":"971500000000",
    "email":"contact@abc.com",
    "website":"https://abc.com",
    "address_line_1":"Street",
    "city":"Dubai",
    "country":"UAE",
    "tax_number":"TRN12345",
    "notes":"Preferred supplier"
  }'

curl "http://localhost:8080/api/v1/suppliers/lookup?search=abc" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/suppliers/{id}/contacts \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name":"John Manager",
    "contact_role":"Sales Manager",
    "phone":"971500000001",
    "email":"john@abc.com",
    "is_primary":true
  }'

curl -X POST http://localhost:8080/api/v1/suppliers/{id}/notes \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"note":"Provides best pricing for flour"}'

curl http://localhost:8080/api/v1/suppliers/{id}/stats \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Purchasing

```bash
curl "http://localhost:8080/api/v1/purchasing/orders?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/purchasing/orders \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "supplier_id":"supplier_uuid_here",
    "order_date":"2026-05-05",
    "expected_delivery_date":"2026-05-10",
    "items":[{
      "item_type":"product",
      "product_id":"product_uuid_here",
      "quantity_ordered":10,
      "unit_id":"unit_uuid_here",
      "unit_cost":15.50,
      "discount_amount":0,
      "tax_rate_id":"tax_rate_uuid_optional"
    }],
    "notes":"optional"
  }'

curl -X POST http://localhost:8080/api/v1/purchasing/invoices \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "supplier_id":"supplier_uuid_here",
    "purchase_order_id":"purchase_order_uuid_optional",
    "invoice_number":"INV-123",
    "invoice_date":"2026-05-05",
    "due_date":"2026-05-20",
    "items":[{
      "item_type":"product",
      "product_id":"product_uuid_here",
      "quantity":10,
      "unit_id":"unit_uuid_here",
      "unit_cost":15.50,
      "expiry_date":"2026-06-01",
      "batch_number":"BATCH-001"
    }]
  }'

curl -X POST http://localhost:8080/api/v1/purchasing/invoices/{id}/post \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/purchasing/receive \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "supplier_id":"supplier_uuid_here",
    "purchase_order_id":"purchase_order_uuid_optional",
    "purchase_invoice_id":"purchase_invoice_uuid_optional",
    "received_date":"2026-05-05",
    "items":[{
      "item_type":"product",
      "product_id":"product_uuid_here",
      "quantity_received":10,
      "unit_id":"unit_uuid_here",
      "expiry_date":"2026-06-01",
      "batch_number":"BATCH-001"
    }]
  }'

curl http://localhost:8080/api/v1/purchasing/summary \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/purchasing/supplier/{supplierId}/history \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Packaging

```bash
curl "http://localhost:8080/api/v1/packaging?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/packaging \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "packaging_name":"Cake Box Large",
    "packaging_category_id":"packaging_category_uuid_here",
    "supplier_id":"supplier_uuid_optional",
    "unit_id":"unit_uuid_here",
    "cost_per_unit":2.50,
    "is_stock_tracked":true,
    "is_consumable":true,
    "reorder_level":50,
    "description":"Large cake box",
    "image_file_id":"appwrite_file_id_optional"
  }'

curl "http://localhost:8080/api/v1/packaging/lookup?search=box" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/packaging/product/{productId} \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "packaging_item_id":"packaging_item_uuid_here",
    "quantity_required":1,
    "is_default":true
  }'

curl http://localhost:8080/api/v1/packaging/product/{productId} \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Recipes / BOM

```bash
curl "http://localhost:8080/api/v1/recipes?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/recipes \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id":"manufactured_product_uuid_here",
    "new_product_variant":{
      "variant_name":"Orange Juice Mocktail",
      "sku":"OJ-MOCKTAIL",
      "sale_price":12
    },
    "recipe_name":"Chocolate Cake Base Recipe",
    "description":"Standard chocolate cake recipe",
    "batch_yield_quantity":10,
    "batch_yield_unit_id":"unit_uuid_here",
    "preparation_time_minutes":90,
    "instructions":"Mix, bake, cool",
    "status":"draft",
    "ingredients":[
      {
        "inventory_item_id":"inventory_item_uuid_here",
        "quantity_required":500,
        "unit_id":"same_unit_uuid_here",
        "wastage_percentage":2,
        "notes":"Use premium flour"
      }
    ],
    "packaging":[
      {
        "packaging_item_id":"packaging_item_uuid_here",
        "quantity_required":10,
        "unit_id":"same_unit_uuid_here",
        "is_optional":false
      }
    ]
  }'

Recipe output can target either the parent product or a product variant:

- send `product_variant_id` to link the recipe to an existing variant
- send `new_product_variant` to create a product variant from the recipe form and link the recipe to it
- omit both to keep the recipe output on the parent product

When manufacturing completes a recipe linked to a variant, finished stock is added to the variant inventory row (`item_type = product_variant`) and POS deducts from that variant when sold.

curl http://localhost:8080/api/v1/recipes/{id}/cost \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/recipes/{id}/recalculate-cost \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/recipes/product/{productId} \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/recipes/{id}/create-version \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"change_note":"Updated flour quantity"}'
```

### Manufacturing

```bash
curl "http://localhost:8080/api/v1/manufacturing/batches?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/manufacturing/batches \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "recipe_id":"active_recipe_uuid_here",
    "planned_quantity":20,
    "production_date":"2026-05-05",
    "notes":"Daily cake production"
  }'

curl -X POST http://localhost:8080/api/v1/manufacturing/batches/{id}/start \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X PATCH http://localhost:8080/api/v1/manufacturing/batches/{id}/ingredients/{lineId} \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"actual_quantity":520,"wastage_quantity":20}'

curl -X POST http://localhost:8080/api/v1/manufacturing/batches/{id}/complete \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "produced_quantity":20,
    "batch_number":"CAKE-BATCH-001",
    "expiry_date":"2026-05-08",
    "wastage_quantity":1,
    "wastage_reason":"Damaged during decoration",
    "notes":"Completed successfully"
  }'

curl "http://localhost:8080/api/v1/manufacturing/summary?date_from=2026-05-01&date_to=2026-05-05" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl http://localhost:8080/api/v1/manufacturing/product/{productId}/history \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Ingredients

```bash
curl "http://localhost:8080/api/v1/ingredients?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/ingredients \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredient_name":"All Purpose Flour",
    "ingredient_category_id":"ingredient_category_uuid_here",
    "supplier_id":"supplier_uuid_optional",
    "unit_id":"unit_uuid_here",
    "cost_per_unit":4.50,
    "is_stock_tracked":true,
    "is_expiry_tracked":true,
    "reorder_level":25,
    "description":"Bakery flour",
    "image_file_id":"appwrite_file_id_optional"
  }'

curl "http://localhost:8080/api/v1/ingredients/lookup?search=flour" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X PATCH http://localhost:8080/api/v1/ingredients/{id}/status \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"status":"inactive"}'
```

### Bakery Orders

```bash
curl "http://localhost:8080/api/v1/bakery-orders?page=1&limit=20" \
  -H "Authorization: Bearer appwrite_jwt_here"

curl -X POST http://localhost:8080/api/v1/bakery-orders \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id":"branch_uuid_here",
    "customer_id":"customer_uuid_optional",
    "customer_name":"Walk-in Customer",
    "customer_phone":"971500000000",
    "order_type":"pickup",
    "event_date":"2026-06-01",
    "pickup_time":"10:00",
    "items":[{
      "product_id":"product_uuid_here",
      "quantity":1,
      "unit_id":"unit_uuid_here",
      "weight":1.5,
      "flavor":"Chocolate",
      "design_notes":"Minimalist",
      "message_text":"Happy Birthday",
      "unit_price":120,
      "customizations_json":"{\"shape\":\"round\"}"
    }],
    "notes":"Custom cake order"
  }'

curl -X POST http://localhost:8080/api/v1/bakery-orders/{id}/payments \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"payment_method_id":"payment_method_uuid_here","amount":50,"payment_type":"deposit"}'

curl -X PATCH http://localhost:8080/api/v1/bakery-orders/{id}/status \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}'

curl -X POST http://localhost:8080/api/v1/bakery-orders/{id}/assign-production \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{"production_batch_id":"production_batch_uuid_here"}'

curl http://localhost:8080/api/v1/bakery-orders/summary \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### List roles

```bash
curl http://localhost:8080/api/v1/roles \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Create role

```bash
curl -X POST http://localhost:8080/api/v1/roles \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "role_name":"Cashier",
    "description":"Sales counter staff",
    "permission_keys":["users.view","products.view","orders.view","pos.view","pos.sell"]
  }'
```

### Update role

```bash
curl -X PATCH http://localhost:8080/api/v1/roles/{id} \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "role_name":"Senior Cashier",
    "description":"Updated cashier role",
    "permission_keys":["users.view","products.view","orders.view","pos.view","pos.sell","reports.view"]
  }'
```

### Delete role

```bash
curl -X DELETE http://localhost:8080/api/v1/roles/{id} \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Get role permissions

```bash
curl http://localhost:8080/api/v1/roles/{id}/permissions \
  -H "Authorization: Bearer appwrite_jwt_here"
```

### Update role permissions

```bash
curl -X PATCH http://localhost:8080/api/v1/roles/{id}/permissions \
  -H "Authorization: Bearer appwrite_jwt_here" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_keys":["users.view","products.view","orders.view","pos.view","pos.sell"]
  }'
```

### List permissions

```bash
curl http://localhost:8080/api/v1/permissions \
  -H "Authorization: Bearer appwrite_jwt_here"
```

## Useful SQL Checks

After connecting to PostgreSQL:

```sql
\c pastries_pos
\dt
SELECT * FROM businesses;
SELECT * FROM users;
SELECT * FROM roles;
SELECT * FROM permissions;
SELECT * FROM role_permissions;
SELECT * FROM subscriptions;
SELECT * FROM audit_logs;
SELECT * FROM tax_rates;
SELECT * FROM payment_methods;
SELECT * FROM unit_categories;
SELECT * FROM units;
SELECT * FROM order_statuses;
SELECT * FROM payment_statuses;
SELECT * FROM products;
SELECT * FROM product_variants;
SELECT * FROM product_media;
SELECT * FROM product_prices;
SELECT * FROM product_taxes;
SELECT * FROM product_categories;
SELECT * FROM ingredient_categories;
SELECT * FROM packaging_categories;
SELECT * FROM supplier_categories;
SELECT * FROM customers;
SELECT * FROM customer_tags;
SELECT * FROM customer_tag_mappings;
SELECT * FROM customer_notes;
SELECT * FROM inventory_items;
SELECT * FROM stock_movements;
SELECT * FROM inventory_adjustments;
SELECT * FROM expiry_batches;
SELECT * FROM ingredients;
SELECT * FROM suppliers;
SELECT * FROM supplier_contacts;
SELECT * FROM supplier_notes;
SELECT * FROM purchase_orders;
SELECT * FROM purchase_order_items;
SELECT * FROM purchase_invoices;
SELECT * FROM purchase_invoice_items;
SELECT * FROM purchase_receipts;
SELECT * FROM purchase_receipt_items;
SELECT * FROM packaging_items;
SELECT * FROM packaging_usage_rules;
SELECT * FROM recipes;
SELECT * FROM recipe_ingredients;
SELECT * FROM recipe_packaging;
SELECT * FROM recipe_versions;
SELECT * FROM production_batches;
SELECT * FROM production_ingredient_consumptions;
SELECT * FROM production_packaging_consumptions;
SELECT * FROM production_outputs;
SELECT * FROM bakery_orders;
SELECT * FROM bakery_order_items;
SELECT * FROM bakery_order_payments;
SELECT * FROM bakery_order_productions;
SELECT * FROM bakery_order_packaging;
```

## Reports Foundation APIs

All report endpoints require authentication and `reports.view`, except CSV export which requires `reports.export`.

```txt
GET  /api/v1/reports/dashboard/summary
GET  /api/v1/reports/chart/sales
GET  /api/v1/reports/chart/payments
GET  /api/v1/reports/chart/orders
GET  /api/v1/reports/sales/summary
GET  /api/v1/reports/sales/daily
GET  /api/v1/reports/sales/by-product
GET  /api/v1/reports/sales/by-category
GET  /api/v1/reports/sales/by-cashier
GET  /api/v1/reports/sales/by-branch
GET  /api/v1/reports/sales/discounts
GET  /api/v1/reports/sales/taxes
GET  /api/v1/reports/sales/top-products
GET  /api/v1/reports/sales/slow-moving-products
GET  /api/v1/reports/sales/trend
GET  /api/v1/reports/receipts
GET  /api/v1/reports/inventory/summary
GET  /api/v1/reports/inventory/current-stock
GET  /api/v1/reports/inventory/stock-valuation
GET  /api/v1/reports/inventory/low-stock
GET  /api/v1/reports/inventory/expiry
GET  /api/v1/reports/inventory/movements
GET  /api/v1/reports/inventory/wastage
GET  /api/v1/reports/inventory/packaging-stock
GET  /api/v1/reports/inventory/audit
GET  /api/v1/reports/inventory/trend
GET  /api/v1/reports/manufacturing/summary
GET  /api/v1/reports/manufacturing/batches
GET  /api/v1/reports/manufacturing/ingredient-consumption
GET  /api/v1/reports/manufacturing/yield-variance
GET  /api/v1/reports/manufacturing/wastage
GET  /api/v1/reports/manufacturing/recipe-costs
GET  /api/v1/reports/manufacturing/trend
GET  /api/v1/reports/bakery-orders/summary
GET  /api/v1/reports/bakery-orders/upcoming
GET  /api/v1/reports/bakery-orders/status
GET  /api/v1/reports/bakery-orders/production-schedule
GET  /api/v1/reports/bakery-orders/pending-payments
GET  /api/v1/reports/bakery-orders/delivery-vs-pickup
GET  /api/v1/reports/bakery-orders/trend
GET  /api/v1/reports/financial/summary
GET  /api/v1/reports/financial/payments
GET  /api/v1/reports/financial/by-payment-method
GET  /api/v1/reports/financial/refunds
GET  /api/v1/reports/financial/outstanding-balances
GET  /api/v1/reports/financial/supplier-payables
GET  /api/v1/reports/financial/purchase-totals
GET  /api/v1/reports/financial/reconciliation
GET  /api/v1/reports/financial/trend
GET  /api/v1/reports/export/csv?report_type=sales
POST /api/v1/reports/export/csv
```

Common filters:

```txt
branch_id, scope, date_from, date_to, timezone, group_by, page, limit, sort_by, sort_order, search
```

Reports default to the authenticated user's current branch. Owner/Admin all-branch reporting requires `branch_id=all` or `scope=all_branches`. Inventory report endpoints additionally require `inventory.view`; manufacturing report endpoints additionally require `manufacturing.view`; bakery orders report endpoints additionally require `orders.view`. Receipt records report returns POS sales receipt status using sales data plus `sale.receipt_viewed` audit events.

## Dashboard Intelligence APIs

All dashboard endpoints require authentication and `dashboard.view`. Dashboard data defaults to the authenticated user's current branch; Owner/Admin all-branch dashboard views require `branch_id=all` or `scope=all_branches`.

```txt
GET /api/v1/dashboard/admin
GET /api/v1/dashboard/cashier
GET /api/v1/dashboard/production
GET /api/v1/dashboard/purchasing
GET /api/v1/dashboard/recent-activity
GET /api/v1/dashboard/alerts
GET /api/v1/dashboard/kpi-summary
```

Common filters:

```txt
branch_id optional
scope optional, supports all_branches for Owner/Admin
timezone optional
limit optional for recent activity
```

Role visibility:

- Admin dashboard: admin/management users.
- Cashier dashboard: POS users.
- Production dashboard: manufacturing users.
- Purchasing dashboard: purchasing or inventory users.

## Receipt Layout Settings APIs

Receipt layout endpoints are under settings and use the existing settings permissions. Read endpoints require `settings.view`; create/update/delete/default/preview require `settings.receipt.update` or the existing settings manage fallback.

```txt
GET    /api/v1/settings/receipt-layouts
POST   /api/v1/settings/receipt-layouts
GET    /api/v1/settings/receipt-layouts/:id
PATCH  /api/v1/settings/receipt-layouts/:id
DELETE /api/v1/settings/receipt-layouts/:id
PATCH  /api/v1/settings/receipt-layouts/:id/default
POST   /api/v1/settings/receipt-layouts/:id/preview
```

Supported `receipt_type` values:

```txt
58mm
80mm
a4
custom
```

`layout_config` is stored as JSONB and is owned by the frontend design editor. Backend validates it is valid JSON, stores it, controls default-layout rules, and keeps receipt totals/sale data authoritative.

Check the created default roles:

```sql
SELECT id, role_name, description FROM roles ORDER BY role_name;
```

## Not Built Yet

Still pending:

- branch module advanced features such as opening hours and tax registrations
- POS sale inventory deduction, packaging deduction from sales, production scheduling calendar, quality control, supplier payment accounting, and advanced reports
- online payment gateway integrations
- production-grade email invitation delivery instead of returning temporary password
- password reset and email verification screens in the frontend/Appwrite flow
- deeper integration tests around Appwrite and PostgreSQL

## Recommended Next Steps

1. run `go run ./cmd/migrate` to apply pending migrations through `000025_sprint4_bakery_orders.sql`
2. restart the API and verify `GET /api/v1/bakery-orders`
3. wire frontend bakery order screens to list, create/update, status, payment, production, and packaging flows
4. continue the next backend sprint with production scheduling, quality control, or POS inventory/packaging deduction
