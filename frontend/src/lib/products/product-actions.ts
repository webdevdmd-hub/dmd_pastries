export type ProductPermissions = {
  canCreate: boolean;
  canEdit: boolean;
  canUpdateStatus: boolean;
  canDelete: boolean;
  canManageVariants: boolean;
};

export type ProductRowAction = "edit" | "variants" | "status" | "archive" | "delete";

/**
 * The actions a product row offers, one per permission the server checks on
 * that route. A single "can manage" flag offered Edit, Deactivate and Delete
 * to a role holding only products.create (ISSUE-065). Creating is not a row
 * action, so it never earns a menu on its own.
 */
export function productRowActions(
  permissions: ProductPermissions,
  productStatus: string,
): ProductRowAction[] {
  const actions: ProductRowAction[] = [];
  if (permissions.canEdit) actions.push("edit");
  if (permissions.canManageVariants) actions.push("variants");
  if (permissions.canUpdateStatus) actions.push("status");
  if (permissions.canUpdateStatus && productStatus !== "archived") actions.push("archive");
  if (permissions.canDelete) actions.push("delete");
  return actions;
}
