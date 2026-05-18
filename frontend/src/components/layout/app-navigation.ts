import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Boxes,
  ChartNoAxesCombined,
  Croissant,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  NotebookTabs,
  PackageOpen,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Soup,
  Truck,
  UserRound,
  Users,
  WalletCards,
  Warehouse,
  Wheat,
} from "lucide-react";

import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import type { Permission } from "@/types/permission";

export type AppNavigationItem = {
  children?: readonly AppNavigationItem[];
  href: string;
  icon: LucideIcon;
  label: string;
  permission?: Permission;
  permissionAny?: readonly Permission[];
};

export type AppNavigationGroup = {
  items: readonly AppNavigationItem[];
  label: string;
};

export const appNavigationGroups = [
  {
    label: "Core",
    items: [
      {
        href: ROUTES.dashboard,
        icon: LayoutDashboard,
        label: "Dashboard",
        permissionAny: [PERMISSIONS.dashboardView],
      },
      {
        href: ROUTES.pos,
        icon: ReceiptText,
        label: "POS Billing",
        permissionAny: [PERMISSIONS.posView, PERMISSIONS.posSell],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        href: ROUTES.orders,
        icon: NotebookTabs,
        label: "Bakery Orders",
        // TODO: Remove POS fallback once every tenant has orders.* permissions seeded.
        permissionAny: [
          PERMISSIONS.ordersView,
          PERMISSIONS.ordersCreate,
          PERMISSIONS.ordersEdit,
          PERMISSIONS.posView,
        ],
      },
      {
        href: ROUTES.products,
        icon: Croissant,
        label: "Products",
        permissionAny: [
          PERMISSIONS.productsView,
          PERMISSIONS.productsCreate,
          PERMISSIONS.productsEdit,
        ],
      },
      {
        href: ROUTES.customers,
        icon: UserRound,
        label: "Customers",
        // TODO: Remove POS fallback once every tenant has customers.* permissions seeded.
        permissionAny: [
          PERMISSIONS.customersView,
          PERMISSIONS.customersCreate,
          PERMISSIONS.customersEdit,
          PERMISSIONS.posView,
        ],
      },
      {
        href: ROUTES.payments,
        icon: Landmark,
        label: "Payments",
        permissionAny: [PERMISSIONS.paymentsView, PERMISSIONS.paymentsAdd, PERMISSIONS.posView],
      },
      {
        href: ROUTES.paymentRefunds,
        icon: ReceiptText,
        label: "Refunds",
        permissionAny: [
          PERMISSIONS.paymentsView,
          PERMISSIONS.paymentsRefund,
          PERMISSIONS.posRefund,
        ],
      },
      {
        href: ROUTES.paymentReconciliations,
        icon: Landmark,
        label: "Reconciliations",
        permissionAny: [
          PERMISSIONS.paymentsReconcile,
          PERMISSIONS.reportsView,
          PERMISSIONS.paymentsView,
        ],
      },
      {
        href: ROUTES.reports,
        icon: ChartNoAxesCombined,
        label: "Reports",
        permissionAny: [PERMISSIONS.reportsView],
        children: [
          {
            href: ROUTES.reportsDashboard,
            icon: ChartNoAxesCombined,
            label: "Dashboard",
            permissionAny: [PERMISSIONS.reportsView],
          },
          {
            href: ROUTES.reportsSales,
            icon: ReceiptText,
            label: "Sales Report",
            permissionAny: [PERMISSIONS.reportsView],
          },
          {
            href: ROUTES.reportsReceipts,
            icon: ReceiptText,
            label: "Sales Receipts",
            permissionAny: [PERMISSIONS.reportsView],
          },
          {
            href: ROUTES.reportsInventory,
            icon: PackageSearch,
            label: "Inventory Report",
            permissionAny: [PERMISSIONS.reportsView, PERMISSIONS.inventoryView],
          },
          {
            href: ROUTES.reportsFinancial,
            icon: WalletCards,
            label: "Payment Report",
            permissionAny: [PERMISSIONS.reportsView],
          },
          {
            href: ROUTES.reportsBakeryOrders,
            icon: NotebookTabs,
            label: "Bakery Orders Report",
            permissionAny: [PERMISSIONS.reportsView, PERMISSIONS.ordersView],
          },
          {
            href: ROUTES.reportsManufacturing,
            icon: Boxes,
            label: "Manufacturing Report",
            permissionAny: [PERMISSIONS.reportsView, PERMISSIONS.manufacturingView],
          },
          {
            href: ROUTES.reportsExport,
            icon: ReceiptText,
            label: "Export Center",
            permissionAny: [PERMISSIONS.reportsExport, PERMISSIONS.reportsView],
          },
        ],
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        href: ROUTES.inventory,
        icon: PackageSearch,
        label: "Inventory",
        permissionAny: [
          PERMISSIONS.inventoryView,
          PERMISSIONS.inventoryOpeningStock,
          PERMISSIONS.inventoryAdjust,
        ],
      },
      {
        href: ROUTES.inventoryLocationBalances,
        icon: MapPinned,
        label: "Location Balances",
        permissionAny: [PERMISSIONS.inventoryView],
      },
      {
        href: ROUTES.inventoryStockTransfers,
        icon: ArrowLeftRight,
        label: "Stock Transfers",
        permissionAny: [
          PERMISSIONS.inventoryView,
          PERMISSIONS.inventoryTransferCreate,
          PERMISSIONS.inventoryTransferComplete,
          PERMISSIONS.inventoryTransferCancel,
        ],
      },
      {
        href: ROUTES.inventoryStockLocations,
        icon: Warehouse,
        label: "Stock Locations",
        permissionAny: [PERMISSIONS.inventoryView, PERMISSIONS.inventoryLocationsManage],
      },
      {
        href: ROUTES.inventoryMovements,
        icon: ListChecks,
        label: "Stock Movements",
        permissionAny: [
          PERMISSIONS.stockMovementsView,
          PERMISSIONS.inventoryMovementsView,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.inventoryLowStock,
        icon: PackageOpen,
        label: "Low Stock",
        permissionAny: [PERMISSIONS.inventoryLowStockView, PERMISSIONS.inventoryView],
      },
      {
        href: ROUTES.inventoryExpiryAlerts,
        icon: Wheat,
        label: "Expiry Alerts",
        permissionAny: [PERMISSIONS.inventoryExpiryView, PERMISSIONS.inventoryView],
      },
    ],
  },
  {
    label: "Supply Chain",
    items: [
      {
        href: ROUTES.suppliers,
        icon: Truck,
        label: "Suppliers",
        // TODO: Remove inventory fallback once every tenant has suppliers.* permissions seeded.
        permissionAny: [
          PERMISSIONS.suppliersView,
          PERMISSIONS.suppliersCreate,
          PERMISSIONS.suppliersEdit,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.purchasing,
        icon: ShoppingCart,
        label: "Purchasing",
        // TODO: Remove inventory fallback once purchasing.* permissions are seeded for every tenant.
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingOrdersCreate,
          PERMISSIONS.purchasingInvoicesCreate,
          PERMISSIONS.purchasingReceiptsCreate,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.purchasingOrders,
        icon: ShoppingCart,
        label: "Purchase Orders",
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingOrdersCreate,
          PERMISSIONS.purchasingOrdersEdit,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.purchasingInvoices,
        icon: ReceiptText,
        label: "Purchase Invoices",
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingInvoicesCreate,
          PERMISSIONS.purchasingInvoicesEdit,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.purchasingReceipts,
        icon: PackageOpen,
        label: "Purchase Receipts",
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingReceiveStock,
          PERMISSIONS.purchasingReceiptsCreate,
          PERMISSIONS.inventoryView,
        ],
      },
    ],
  },
  {
    label: "Production",
    items: [
      {
        href: ROUTES.ingredients,
        icon: Wheat,
        label: "Ingredients",
        permissionAny: [
          PERMISSIONS.ingredientsView,
          PERMISSIONS.ingredientsCreate,
          PERMISSIONS.ingredientsEdit,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.packaging,
        icon: PackageOpen,
        label: "Packaging",
        permissionAny: [
          PERMISSIONS.packagingView,
          PERMISSIONS.packagingCreate,
          PERMISSIONS.packagingEdit,
          PERMISSIONS.masterDataView,
        ],
      },
      {
        href: ROUTES.recipes,
        icon: ListChecks,
        label: "Recipes / BOM",
        // TODO: Remove products fallback once recipes.* permissions are seeded for every tenant.
        permissionAny: [
          PERMISSIONS.recipesView,
          PERMISSIONS.recipesCreate,
          PERMISSIONS.recipesEdit,
          PERMISSIONS.productsView,
        ],
      },
      {
        href: ROUTES.manufacturing,
        icon: Soup,
        label: "Manufacturing",
        // TODO: Remove inventory fallback once manufacturing.* permissions are seeded for every tenant.
        permissionAny: [
          PERMISSIONS.manufacturingView,
          PERMISSIONS.manufacturingBatchesCreate,
          PERMISSIONS.manufacturingBatchesEdit,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.manufacturingBatches,
        icon: Boxes,
        label: "Production Batches",
        permissionAny: [
          PERMISSIONS.manufacturingView,
          PERMISSIONS.manufacturingBatchesCreate,
          PERMISSIONS.manufacturingBatchesEdit,
          PERMISSIONS.inventoryView,
        ],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: ROUTES.users, icon: Users, label: "Users", permission: PERMISSIONS.usersView },
      {
        href: ROUTES.roles,
        icon: ShieldCheck,
        label: "Roles / RBAC",
        permissionAny: [
          PERMISSIONS.rolesView,
          PERMISSIONS.rolesCreate,
          PERMISSIONS.rolesEdit,
          PERMISSIONS.rolesPermissionsView,
        ],
      },
      {
        href: ROUTES.auditLogs,
        icon: ListChecks,
        label: "Audit Logs",
        permissionAny: [PERMISSIONS.auditLogsView],
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: ROUTES.settings,
        icon: Settings,
        label: "Settings & Master Data",
        permissionAny: [
          PERMISSIONS.settingsView,
          PERMISSIONS.settingsCompanyUpdate,
          PERMISSIONS.settingsTaxRatesManage,
          PERMISSIONS.settingsPaymentMethodsManage,
          PERMISSIONS.masterDataView,
        ],
      },
    ],
  },
] as const satisfies readonly AppNavigationGroup[];

export const appNavigation: AppNavigationItem[] = appNavigationGroups.flatMap((group) => [
  ...group.items,
]);
