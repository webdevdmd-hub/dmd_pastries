import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";

export type CustomerDetailPermissions = {
  canManage: boolean;
  canView: boolean;
};

/**
 * The permission set a customer's details need, derived once so the full page
 * and the drawer cannot drift apart on who may do what.
 */
export function useCustomerDetailPermissions(): CustomerDetailPermissions {
  const { hasAnyPermission } = usePermission();

  return {
    canView: hasAnyPermission([PERMISSIONS.customersView, PERMISSIONS.posView]),
    canManage: hasAnyPermission([
      PERMISSIONS.customersEdit,
      PERMISSIONS.customersStatusUpdate,
      PERMISSIONS.customersNotesManage,
      PERMISSIONS.customersTagsManage,
      PERMISSIONS.posSell,
    ]),
  };
}
