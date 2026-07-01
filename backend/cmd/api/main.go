package main

import (
	"log"
	_ "time/tzdata"

	"pastries-pos/internal/config"
	"pastries-pos/internal/database"
	"pastries-pos/internal/middleware"
	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/auth"
	"pastries-pos/internal/modules/bakeryorders"
	"pastries-pos/internal/modules/branches"
	"pastries-pos/internal/modules/businesses"
	"pastries-pos/internal/modules/customers"
	"pastries-pos/internal/modules/dashboard"
	dashboardcache "pastries-pos/internal/modules/dashboard/cache"
	"pastries-pos/internal/modules/expenses"
	"pastries-pos/internal/modules/ingredients"
	"pastries-pos/internal/modules/inventory"
	"pastries-pos/internal/modules/manufacturing"
	"pastries-pos/internal/modules/masterdata"
	"pastries-pos/internal/modules/packaging"
	"pastries-pos/internal/modules/payments"
	"pastries-pos/internal/modules/permissions"
	"pastries-pos/internal/modules/pos"
	"pastries-pos/internal/modules/products"
	"pastries-pos/internal/modules/productvariants"
	"pastries-pos/internal/modules/purchasing"
	"pastries-pos/internal/modules/recipes"
	"pastries-pos/internal/modules/reports"
	reportcache "pastries-pos/internal/modules/reports/cache"
	"pastries-pos/internal/modules/roles"
	"pastries-pos/internal/modules/salesreturns"
	"pastries-pos/internal/modules/settings"
	"pastries-pos/internal/modules/subscriptions"
	"pastries-pos/internal/modules/superadmin"
	"pastries-pos/internal/modules/suppliers"
	"pastries-pos/internal/modules/systemhealth"
	"pastries-pos/internal/modules/users"
	"pastries-pos/internal/server"
	"pastries-pos/internal/shared/utils"
)

func main() {
	cfg := config.Load()

	db, err := database.NewPostgres(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	if cfg.AutoRunMigrations {
		if result, err := database.RunMigrations(db, cfg.MigrationsPath); err != nil {
			log.Fatalf("database migration failed: %v", err)
		} else {
			log.Printf("database migrations complete: %d applied, %d skipped", len(result.Applied), len(result.Skipped))
		}
	}

	if err := database.VerifySchema(db); err != nil {
		log.Fatalf("database schema verification failed: %v", err)
	}

	permissionRepo := permissions.NewRepository(db)
	roleRepo := roles.NewRepository(db)
	businessRepo := businesses.NewRepository(db)
	subscriptionRepo := subscriptions.NewRepository(db)
	auditRepo := audit.NewRepository(db)
	branchRepo := branches.NewRepository(db)
	settingsRepo := settings.NewRepository(db)
	masterDataRepo := masterdata.NewRepository(db)
	packagingRepo := packaging.NewRepository(db)
	productRepo := products.NewRepository(db)
	productVariantRepo := productvariants.NewRepository(db)
	posRepo := pos.NewRepository(db)
	paymentRepo := payments.NewRepository(db)
	customerRepo := customers.NewRepository(db)
	ingredientRepo := ingredients.NewRepository(db)
	inventoryRepo := inventory.NewRepository(db)
	manufacturingRepo := manufacturing.NewRepository(db)
	supplierRepo := suppliers.NewRepository(db)
	purchasingRepo := purchasing.NewRepository(db)
	recipeRepo := recipes.NewRepository(db)
	bakeryOrderRepo := bakeryorders.NewRepository(db)
	reportRepo := reports.NewRepository(db)
	dashboardRepo := dashboard.NewRepository(db)
	expenseRepo := expenses.NewRepository(db)
	salesReturnRepo := salesreturns.NewRepository(db)
	userRepo := users.NewRepository(db)
	authRepo := auth.NewRepository(db)
	accountingRepo := accounting.NewRepository(db)

	if _, err := permissionRepo.EnsureDefaults(db); err != nil {
		log.Fatalf("permission seeding failed: %v", err)
	}
	if err := roleRepo.BackfillDefaultRolePermissions(db, auth.DefaultRolePermissionPresets()); err != nil {
		log.Fatalf("default role permission backfill failed: %v", err)
	}

	appwriteClient := utils.NewAppwriteClient(cfg)

	authService := auth.NewService(
		db,
		cfg,
		appwriteClient,
		authRepo,
		userRepo,
		businessRepo,
		roleRepo,
		permissionRepo,
		subscriptionRepo,
		auditRepo,
	)
	authHandler := auth.NewHandler(authService)

	userService := users.NewService(
		db,
		appwriteClient,
		userRepo,
		roleRepo,
		branchRepo,
		businessRepo,
		auditRepo,
	)
	userHandler := users.NewHandler(userService)

	branchService := branches.NewService(db, branchRepo, auditRepo, inventoryRepo)
	branchHandler := branches.NewHandler(branchService)
	businessService := businesses.NewService(db, businessRepo, branchRepo, roleRepo, auditRepo)
	businessHandler := businesses.NewHandler(businessService)
	settingsService := settings.NewService(db, settingsRepo, businessRepo, auditRepo)
	settingsHandler := settings.NewHandler(settingsService)
	masterDataService := masterdata.NewService(db, masterDataRepo, auditRepo)
	masterDataHandler := masterdata.NewHandler(masterDataService)
	packagingService := packaging.NewService(db, packagingRepo, inventoryRepo, auditRepo)
	packagingHandler := packaging.NewHandler(packagingService)
	productService := products.NewService(db, productRepo, auditRepo)
	productHandler := products.NewHandler(productService)
	productVariantService := productvariants.NewService(db, productVariantRepo, auditRepo)
	productVariantHandler := productvariants.NewHandler(productVariantService)
	accountingService := accounting.NewService(db, accountingRepo, auditRepo)
	accountingHandler := accounting.NewHandler(accountingService)
	inventoryService := inventory.NewService(db, inventoryRepo, auditRepo, accountingService)
	inventoryHandler := inventory.NewHandler(inventoryService)
	posService := pos.NewService(db, posRepo, inventoryService, auditRepo, accountingService)
	posHandler := pos.NewHandler(posService)
	paymentService := payments.NewService(db, paymentRepo, auditRepo)
	paymentHandler := payments.NewHandler(paymentService)
	customerService := customers.NewService(db, customerRepo, auditRepo)
	customerHandler := customers.NewHandler(customerService)
	ingredientService := ingredients.NewService(db, ingredientRepo, inventoryRepo, auditRepo)
	ingredientHandler := ingredients.NewHandler(ingredientService)
	manufacturingService := manufacturing.NewService(db, manufacturingRepo, inventoryRepo, inventoryService, auditRepo, accountingService)
	manufacturingHandler := manufacturing.NewHandler(manufacturingService)
	supplierService := suppliers.NewService(db, supplierRepo, auditRepo)
	supplierHandler := suppliers.NewHandler(supplierService)
	purchasingService := purchasing.NewService(db, purchasingRepo, inventoryRepo, inventoryService, auditRepo, accountingService)
	purchasingHandler := purchasing.NewHandler(purchasingService)
	recipeService := recipes.NewService(db, recipeRepo, auditRepo)
	recipeHandler := recipes.NewHandler(recipeService)
	manufacturingService.SetPricingService(productService)
	purchasingService.SetPricingService(productService)
	recipeService.SetPricingService(productService)
	bakeryOrderService := bakeryorders.NewService(db, bakeryOrderRepo, auditRepo, manufacturingService, accountingService)
	bakeryOrderHandler := bakeryorders.NewHandler(bakeryOrderService)
	auditService := audit.NewService(auditRepo)
	auditHandler := audit.NewHandler(auditService)

	roleService := roles.NewService(db, roleRepo, permissionRepo)
	roleHandler := roles.NewHandler(roleService)

	permissionService := permissions.NewService(permissionRepo)
	permissionHandler := permissions.NewHandler(permissionService)
	reportCacheService := reportcache.NewService()
	reportService := reports.NewService(db, reportRepo, auditRepo, reportCacheService)
	reportHandler := reports.NewHandler(reportService)
	dashboardCacheService := dashboardcache.NewService()
	dashboardService := dashboard.NewService(db, dashboardRepo, auditRepo, dashboardCacheService)
	dashboardHandler := dashboard.NewHandler(dashboardService)
	expenseService := expenses.NewService(db, expenseRepo, auditRepo)
	expenseHandler := expenses.NewHandler(expenseService)
	salesReturnService := salesreturns.NewService(db, salesReturnRepo, inventoryService, auditRepo, accountingService)
	salesReturnHandler := salesreturns.NewHandler(salesReturnService)
	superAdminService := superadmin.NewService(db)

	authMiddleware := middleware.NewAuthMiddleware(authService)
	permissionMiddleware := middleware.NewPermissionMiddleware()
	permit := permissionMiddleware.RequireAnyPermission

	router := server.NewRouter(cfg)
	auth.RegisterRoutes(router, authHandler, authMiddleware.RequireAuth())
	users.RegisterPublicAuthRoutes(router, userHandler)
	users.RegisterRoutes(
		router,
		userHandler,
		authMiddleware.RequireAuth(),
		permit("users.view"),
		permit("users.create", "users.invite"),
		permit("users.edit", "users.status.update", "users.invitation.resend", "users.invitation.cancel", "branches.access.manage"),
		permit("users.delete"),
	)
	branches.RegisterRoutes(
		router,
		branchHandler,
		authMiddleware.RequireAuth(),
		permit("branches.view", "settings.view"),
		permit("branches.create", "branches.edit", "branches.status.update", "branches.manage", "settings.manage"),
	)
	businesses.RegisterRoutes(
		router,
		businessHandler,
		authMiddleware.RequireAuth(),
		permit("settings.view", "branches.switch"),
		permit("settings.company.update", "settings.manage"),
	)
	settings.RegisterRoutes(
		router,
		settingsHandler,
		authMiddleware.RequireAuth(),
		permit("settings.view"),
		permit("settings.company.update", "settings.tax_rates.manage", "settings.payment_methods.manage", "settings.receipt.update", "settings.hardware.update", "settings.notifications.update", "settings.manage"),
	)
	masterdata.RegisterRoutes(
		router,
		masterDataHandler,
		authMiddleware.RequireAuth(),
		permit("master_data.view"),
		permit("master_data.units.manage", "master_data.product_categories.manage", "master_data.ingredient_categories.manage", "master_data.packaging_categories.manage", "master_data.order_statuses.manage", "master_data.payment_statuses.manage", "master_data.manage"),
	)
	packaging.RegisterRoutes(
		router,
		packagingHandler,
		authMiddleware.RequireAuth(),
		permit("packaging.view", "master_data.view"),
		permit("packaging.create", "packaging.edit", "packaging.delete", "packaging.status.update", "packaging.usage_rules.manage", "master_data.manage"),
	)
	products.RegisterRoutes(
		router,
		productHandler,
		authMiddleware.RequireAuth(),
		permit("products.view"),
		permit("products.create", "products.edit", "products.delete", "products.status.update", "products.images.manage", "products.manage"),
		permit("products.view", "pos.view"),
	)
	productvariants.RegisterRoutes(
		router,
		productVariantHandler,
		authMiddleware.RequireAuth(),
		permit("products.view"),
		permit("products.variants.manage", "products.manage"),
	)
	pos.RegisterRoutes(
		router,
		posHandler,
		authMiddleware.RequireAuth(),
		permit("pos.view"),
		permit("pos.view", "pos.sell", "pos.checkout"),
		permit("pos.sell", "pos.checkout", "pos.hold_sale", "pos.resume_sale", "pos.cancel_held_sale"),
		permit("pos.refund"),
		permit("pos.void", "pos.refund"),
	)
	salesreturns.RegisterRoutes(
		router,
		salesReturnHandler,
		authMiddleware.RequireAuth(),
		permit("sales_returns.view", "pos.view"),
		permit("sales_returns.create", "sales_returns.manage"),
		permit("sales_returns.edit", "sales_returns.manage"),
		permit("sales_returns.post", "sales_returns.manage"),
		permit("sales_returns.cancel", "sales_returns.manage"),
	)
	payments.RegisterRoutes(
		router,
		paymentHandler,
		authMiddleware.RequireAuth(),
		permit("payments.view", "pos.view"),
		permit("payments.add", "payments.manage", "pos.sell"),
		permit("payments.refund", "pos.refund"),
		permit("payments.summary.view", "payments.view", "reports.view"),
		permit("payments.reconcile", "reports.view"),
	)
	customers.RegisterRoutes(
		router,
		customerHandler,
		authMiddleware.RequireAuth(),
		permit("customers.view", "pos.view"),
		permit("customers.create", "customers.edit", "customers.delete", "customers.status.update", "customers.notes.manage", "customers.tags.manage", "customers.quick_create", "customers.manage", "pos.sell"),
	)
	ingredients.RegisterRoutes(
		router,
		ingredientHandler,
		authMiddleware.RequireAuth(),
		permit("ingredients.view", "master_data.view"),
		permit("ingredients.create", "ingredients.edit", "ingredients.delete", "ingredients.status.update", "master_data.manage"),
	)
	inventory.RegisterRoutes(
		router,
		inventoryHandler,
		authMiddleware.RequireAuth(),
		permit("inventory.view"),
		permit("inventory.opening_stock", "inventory.adjust", "inventory.expiry_batches.manage", "inventory.manage"),
		permit("inventory.locations.manage", "inventory.manage"),
		permit("inventory.transfer.create", "inventory.manage"),
		permit("inventory.transfer.complete", "inventory.manage"),
		permit("inventory.transfer.cancel", "inventory.manage"),
	)
	inventory.RegisterStockMovementRoutes(
		router,
		inventoryHandler,
		authMiddleware.RequireAuth(),
		permit("stock_movements.view", "inventory.movements.view", "inventory.view"),
		permit("stock_movements.manual_create", "stock_movements.reverse", "inventory.manage"),
	)
	manufacturing.RegisterRoutes(
		router,
		manufacturingHandler,
		authMiddleware.RequireAuth(),
		permit("manufacturing.view", "inventory.view"),
		permit("manufacturing.batches.create", "manufacturing.batches.edit", "manufacturing.batches.start", "manufacturing.batches.consume", "manufacturing.batches.produce", "manufacturing.batches.wastage", "manufacturing.batches.complete", "manufacturing.batches.cancel", "manufacturing.manage", "inventory.manage"),
	)
	suppliers.RegisterRoutes(
		router,
		supplierHandler,
		authMiddleware.RequireAuth(),
		permit("suppliers.view", "inventory.view"),
		permit("suppliers.create", "suppliers.edit", "suppliers.delete", "suppliers.status.update", "suppliers.contacts.manage", "suppliers.notes.manage", "suppliers.manage", "inventory.manage"),
	)
	purchasing.RegisterRoutes(
		router,
		purchasingHandler,
		authMiddleware.RequireAuth(),
		permit("purchasing.view", "purchasing.returns.view", "inventory.view"),
		permit("purchasing.orders.create", "purchasing.orders.edit", "purchasing.orders.delete", "purchasing.orders.status.update", "purchasing.invoices.create", "purchasing.invoices.edit", "purchasing.invoices.post", "purchasing.invoices.cancel", "purchasing.receipts.create", "purchasing.receipts.post", "purchasing.receipts.cancel", "purchasing.returns.create", "purchasing.returns.edit", "purchasing.returns.post", "purchasing.returns.cancel", "purchasing.returns.manage", "purchasing.receive_stock", "purchasing.manage", "inventory.manage"),
	)
	recipes.RegisterRoutes(
		router,
		recipeHandler,
		authMiddleware.RequireAuth(),
		permit("recipes.view", "products.view"),
		permit("recipes.create", "recipes.edit", "recipes.delete", "recipes.status.update", "recipes.ingredients.manage", "recipes.packaging.manage", "recipes.cost.recalculate", "recipes.versions.create", "recipes.manage", "products.manage"),
	)
	bakeryorders.RegisterRoutes(
		router,
		bakeryOrderHandler,
		authMiddleware.RequireAuth(),
		permit("orders.view", "pos.view"),
		permit("orders.create", "orders.edit", "orders.delete", "orders.status.update", "orders.payments.manage", "orders.production.assign", "orders.packaging.manage", "orders.manage", "pos.sell"),
		permit("products.create", "products.manage"),
		permit("products.variants.manage", "products.manage"),
	)
	reports.RegisterRoutes(
		router,
		reportHandler,
		authMiddleware.RequireAuth(),
		permit("reports.view"),
		permit("inventory.view"),
		permit("manufacturing.view"),
		permit("orders.view", "pos.view"),
		permit("reports.export"),
	)
	dashboard.RegisterRoutes(
		router,
		dashboardHandler,
		authMiddleware.RequireAuth(),
		permit("dashboard.view"),
	)
	accounting.RegisterRoutes(
		router,
		accountingHandler,
		authMiddleware.RequireAuth(),
		permit("accounting.view"),
		permit("accounting.accounts.manage", "accounting.journal_entries.manage"),
	)
	expenses.RegisterRoutes(
		router,
		expenseHandler,
		authMiddleware.RequireAuth(),
		permit("expenses.view", "accounting.view"),
		permit("expenses.create", "expenses.manage", "accounting.journal_entries.manage"),
		permit("expenses.edit", "expenses.manage", "accounting.journal_entries.manage"),
		permit("expenses.delete", "expenses.manage", "accounting.journal_entries.manage"),
	)
	audit.RegisterRoutes(
		router,
		auditHandler,
		authMiddleware.RequireAuth(),
		permit("audit_logs.view", "settings.manage"),
	)
	roles.RegisterRoutes(
		router,
		roleHandler,
		authMiddleware.RequireAuth(),
		permit("roles.view"),
		permit("roles.create", "roles.edit", "roles.delete", "roles.permissions.update", "roles.manage"),
	)
	permissions.RegisterRoutes(
		router,
		permissionHandler,
		authMiddleware.RequireAuth(),
		permit("roles.permissions.view", "roles.view", "roles.manage"),
	)
	systemhealth.RegisterRoutes(
		router,
		systemhealth.NewHandler(router),
		authMiddleware.RequireAuth(),
		permit("settings.view", "settings.manage"),
	)
	superadmin.RegisterRoutes(
		router,
		superadmin.NewHandler(superAdminService),
		authMiddleware.RequireAuth(),
		permissionMiddleware.RequirePlatformAdmin(),
	)

	if err := server.Run(router, cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
