import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";

export type OrderDetailPermissions = {
  canConvertToProduct: boolean;
  canConvertToVariant: boolean;
  canManage: boolean;
  canView: boolean;
};

/**
 * The permission set an order's details need, derived once so the full page
 * and the drawer cannot drift apart on who may do what.
 */
export function useOrderDetailPermissions(): OrderDetailPermissions {
  const { hasAnyPermission, hasPermission } = usePermission();
  // TODO: Remove POS fallback after orders.* permissions are seeded for every tenant.
  const canView = hasAnyPermission([PERMISSIONS.ordersView, PERMISSIONS.posView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.ordersEdit,
    PERMISSIONS.ordersStatusUpdate,
    PERMISSIONS.ordersPaymentsManage,
    PERMISSIONS.ordersProductionAssign,
    PERMISSIONS.ordersPackagingManage,
    PERMISSIONS.posSell,
  ]);
  const canManageOrderCatalogLinks = hasAnyPermission([
    PERMISSIONS.ordersEdit,
    PERMISSIONS.posSell,
  ]);

  return {
    canConvertToProduct: canManageOrderCatalogLinks && hasPermission(PERMISSIONS.productsCreate),
    canConvertToVariant:
      canManageOrderCatalogLinks && hasPermission(PERMISSIONS.productsVariantsManage),
    canManage,
    canView,
  };
}
