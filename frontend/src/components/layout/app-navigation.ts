import type { LucideIcon } from "lucide-react";
import {
  ChartNoAxesCombined,
  Croissant,
  FileMinus2,
  FileText,
  Landmark,
  LayoutDashboard,
  ListChecks,
  NotebookTabs,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  RotateCcwSquare,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Soup,
  Truck,
  UserRound,
  Users,
  WalletCards,
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
        href: ROUTES.reports,
        icon: ChartNoAxesCombined,
        label: "Reports",
        permissionAny: [PERMISSIONS.reportsView],
      },
    ],
  },
  {
    // Money in, money out and the setup behind both, in one place.
    //
    // These four lived in three different groups under three vocabularies:
    // "Payments" under Sales, "Payments Made" and "Vendor Credits" under Supply
    // Chain, and the setup under Settings. Worse, Refunds, Returns and
    // Reconciliation had no sidebar entry at all — the payments overview had to
    // carry four navigation cards to reach them, which is why that screen ended
    // up being a dashboard, a nav hub and a table at once.
    label: "Money",
    items: [
      {
        href: ROUTES.payments,
        icon: Landmark,
        label: "Payments",
        permissionAny: [PERMISSIONS.paymentsView, PERMISSIONS.paymentsAdd, PERMISSIONS.posView],
      },
      {
        href: ROUTES.purchasingPayments,
        icon: WalletCards,
        label: "Payments Made",
        permissionAny: [PERMISSIONS.purchasingView, PERMISSIONS.inventoryView],
      },
      {
        href: ROUTES.purchasingReturns,
        icon: RotateCcwSquare,
        label: "Vendor Credits",
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingReturnsView,
          PERMISSIONS.purchasingReturnsCreate,
          PERMISSIONS.purchasingReturnsManage,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.settingsPaymentSetup,
        icon: WalletCards,
        label: "Payment Setup",
        permissionAny: [
          PERMISSIONS.settingsView,
          PERMISSIONS.settingsPaymentMethodsManage,
          PERMISSIONS.accountingView,
          PERMISSIONS.accountingAccountsManage,
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
        href: ROUTES.purchasingOrders,
        icon: ShoppingCart,
        label: "Purchase Orders",
        // TODO: Remove inventory fallback once purchasing.* permissions are seeded for every tenant.
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingOrdersCreate,
          PERMISSIONS.purchasingOrdersEdit,
          PERMISSIONS.purchasingOrdersStatusUpdate,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.purchasingInvoices,
        icon: FileText,
        label: "Bills",
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingInvoicesCreate,
          PERMISSIONS.purchasingInvoicesEdit,
          PERMISSIONS.purchasingInvoicesPost,
          PERMISSIONS.inventoryView,
        ],
      },
      {
        href: ROUTES.purchasingReceipts,
        icon: PackageCheck,
        label: "Receive Goods",
        permissionAny: [
          PERMISSIONS.purchasingView,
          PERMISSIONS.purchasingReceiptsCreate,
          PERMISSIONS.purchasingReceiptsPost,
          PERMISSIONS.purchasingReceiveStock,
          PERMISSIONS.inventoryView,
        ],
      },
      // "Payments Made" and "Vendor Credits" moved to the Money group. They are
      // the outgoing half of the same job as /payments, and reading them beside
      // the incoming half beats reading them beside goods receipts.
      {
        href: ROUTES.expenses,
        icon: FileMinus2,
        label: "Expenses",
        permissionAny: [
          PERMISSIONS.expensesView,
          PERMISSIONS.expensesCreate,
          PERMISSIONS.expensesEdit,
          PERMISSIONS.expensesManage,
          PERMISSIONS.purchasingView,
        ],
      },
    ],
  },
  {
    label: "Production",
    items: [
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
        href: ROUTES.manufacturingBatches,
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
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: ROUTES.accounting,
        icon: Landmark,
        label: "Accounting",
        permissionAny: [
          PERMISSIONS.accountingView,
          PERMISSIONS.accountingAccountsManage,
          PERMISSIONS.accountingJournalEntriesManage,
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
