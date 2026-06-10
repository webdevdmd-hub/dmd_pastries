import type { LucideIcon } from "lucide-react";
import {
  ChartNoAxesCombined,
  Croissant,
  FileMinus2,
  Landmark,
  LayoutDashboard,
  ListChecks,
  NotebookTabs,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Soup,
  Truck,
  UserRound,
  Users,
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
        href: ROUTES.reports,
        icon: ChartNoAxesCombined,
        label: "Reports",
        permissionAny: [PERMISSIONS.reportsView],
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
