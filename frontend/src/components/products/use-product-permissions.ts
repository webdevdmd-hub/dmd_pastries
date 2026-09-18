import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";
import type { ProductPermissions } from "@/lib/products/product-actions";

export type { ProductPermissions } from "@/lib/products/product-actions";

/**
 * One flag per product action, matching the server's one guard per route
 * (ISSUE-065). Derived once so the catalogue, the drawer and the full page
 * cannot drift apart on who may do what.
 */
export function useProductPermissions(): ProductPermissions {
  const { hasPermission } = usePermission();

  return {
    canCreate: hasPermission(PERMISSIONS.productsCreate),
    canEdit: hasPermission(PERMISSIONS.productsEdit),
    canUpdateStatus: hasPermission(PERMISSIONS.productsStatusUpdate),
    canDelete: hasPermission(PERMISSIONS.productsDelete),
    canManageVariants: hasPermission(PERMISSIONS.productsVariantsManage),
  };
}
