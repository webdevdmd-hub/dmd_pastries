import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";

export type SupplierDetailPermissions = {
  canManage: boolean;
  canView: boolean;
};

/**
 * The permission set a supplier's details need, derived once so the full page
 * and the drawer cannot drift apart on who may do what.
 */
export function useSupplierDetailPermissions(): SupplierDetailPermissions {
  const { hasAnyPermission } = usePermission();

  return {
    canView: hasAnyPermission([PERMISSIONS.suppliersView, PERMISSIONS.inventoryView]),
    canManage: hasAnyPermission([
      PERMISSIONS.suppliersEdit,
      PERMISSIONS.suppliersStatusUpdate,
      PERMISSIONS.suppliersContactsManage,
      PERMISSIONS.suppliersNotesManage,
    ]),
  };
}
