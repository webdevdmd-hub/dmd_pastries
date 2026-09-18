/**
 * What each catalogue delete tells the person before it runs, in one place so
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

/** The packaging counterpart of ingredientDeleteConfirmation (ISSUE-083). */
export function packagingDeleteConfirmation(name: string): DeleteConfirmation {
  return {
    title: `Delete ${name}?`,
    consequence: `${name} is removed from the packaging list, and its empty stock record leaves inventory with it. A packaging item with stock on hand, stock movements, purchase documents, product packaging rules or a recipe using it cannot be deleted; deactivate it instead.`,
    confirmLabel: "Delete packaging item",
    cancelLabel: "Keep packaging item",
  };
}
