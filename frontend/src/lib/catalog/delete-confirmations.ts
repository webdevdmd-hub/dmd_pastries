/**
 * What each catalogue and stock delete tells the person before it runs, in one place so
 * the words can be checked against what the server actually does
 * (scripts/check-delete-confirmations.mjs).
 *
 * The shape is the confirm request `useConfirm()` takes: both labels name the
 * action, never "Cancel" / "Confirm", and the consequence says what happens
 * to the record and what refuses the delete.
 */
export type DeleteConfirmation = {
  cancelLabel: string;
  confirmLabel: string;
  consequence: string;
  title: string;
};

/**
 * Creating an ingredient creates its inventory row, and deleting it now takes
 * an empty row with it. Stock history refuses the delete instead of leaving
 * the row behind (ISSUE-083).
 */
export function ingredientDeleteConfirmation(name: string): DeleteConfirmation {
  return {
    title: `Delete ${name}?`,
    consequence: `${name} is removed from the ingredient list, and its empty stock record leaves inventory with it. An ingredient with stock on hand, stock movements, expiry batches, purchase documents or a recipe using it cannot be deleted; deactivate it instead.`,
    confirmLabel: "Delete ingredient",
    cancelLabel: "Keep ingredient",
  };
}

/**
 * The product dialog said the product "is archived". It is not: it is
 * soft-deleted, never shows under the Archived filter and cannot be restored
 * (ISSUE-086). Archiving is the separate Archive action, and it is what a
 * product with history needs instead.
 */
export function productDeleteConfirmation(name: string): DeleteConfirmation {
  return {
    title: `Delete ${name}?`,
    consequence: `${name} and its variants are removed from the catalogue and the till, and cannot be restored. A product with sales, orders, stock, recipes or purchases cannot be deleted; archive it instead, which retires it and keeps its history.`,
    confirmLabel: "Delete product",
    cancelLabel: "Keep product",
  };
}

/**
 * A variant was deleted on one click, with no question asked, while its
 * inventory row stayed behind and sales, orders and recipes that named it
 * showed a blank variant (ISSUE-084). The server now refuses a used variant
 * and retires an unused one's stock record with it.
 */
export function variantDeleteConfirmation(
  productName: string,
  variantName: string,
): DeleteConfirmation {
  return {
    title: `Delete ${variantName}?`,
    consequence: `${variantName} is removed from ${productName} and from the till, and its empty stock record leaves inventory with it. A variant with sales, orders, stock on hand, stock movements or a recipe cannot be deleted; set it to inactive instead.`,
    confirmLabel: "Delete variant",
    cancelLabel: "Keep variant",
  };
}

/**
 * Stock locations deleted on one click, and a draft transfer completing
 * afterwards could land stock on the deleted location (ISSUE-085). The server
 * now refuses while the location holds stock, is on a draft transfer, or is
 * the default.
 */
export function stockLocationDeleteConfirmation(name: string): DeleteConfirmation {
  return {
    title: `Delete ${name}?`,
    consequence: `${name} is removed from your stock locations. A location that still holds stock or is on a draft transfer cannot be deleted; move its stock out and complete or cancel the transfer first. The default location cannot be deleted.`,
    confirmLabel: "Delete location",
    cancelLabel: "Keep location",
  };
}

/** The packaging counterpart of ingredientDeleteConfirmation (ISSUE-083). */
export function packagingDeleteConfirmation(name: string): DeleteConfirmation {
  return {
    title: `Delete ${name}?`,
    consequence: `${name} is removed from the packaging list, and its empty stock record leaves inventory with it. A packaging item with stock on hand, stock movements, purchase documents, product packaging rules or a recipe using it cannot be deleted; deactivate it instead.`,
    confirmLabel: "Delete packaging item",
    cancelLabel: "Keep packaging item",
  };
}
