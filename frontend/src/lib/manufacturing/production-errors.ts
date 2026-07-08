import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { ManufacturingRecipeOption } from "@/types/manufacturing";

export const EMPTY_BOM_PRODUCTION_MESSAGE =
  "This recipe has no ingredients or packaging. Add BOM lines before producing.";

export const PREVIEW_OUT_OF_SYNC_MESSAGE =
  "Recipe preview and production validation are out of sync. Refresh the recipe or reopen the dialog.";

export const PREVIEW_REQUIRED_MESSAGE =
  "Production preview is required before producing. Wait for stock validation to finish.";

export type ProductionFeedback = {
  message: string;
  title: string;
  tone: "error" | "info" | "success" | "warning";
};

function detailString(details: Record<string, unknown> | undefined, key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function detailStringList(details: Record<string, unknown> | undefined, key: string): string[] {
  const value = details?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function shortageSummary(details: Record<string, unknown> | undefined): string | null {
  const shortages = details?.shortages;

  if (!Array.isArray(shortages) || shortages.length === 0) {
    return null;
  }

  const parts = shortages.slice(0, 3).map((shortage) => {
    if (typeof shortage !== "object" || shortage === null) {
      return "one item";
    }

    const row = shortage as Record<string, unknown>;
    const itemName = typeof row.item_name === "string" ? row.item_name : "one item";
    const required =
      typeof row.required_quantity === "number" ? row.required_quantity.toLocaleString() : null;
    const available =
      typeof row.available_quantity === "number" ? row.available_quantity.toLocaleString() : null;

    return required !== null && available !== null
      ? `${itemName} needs ${required}, available ${available}`
      : itemName;
  });

  const remainingCount = shortages.length - parts.length;
  const suffix = remainingCount > 0 ? ` and ${remainingCount.toLocaleString()} more` : "";

  return `${parts.join(", ")}${suffix}`;
}

export function recipeHasKnownEmptyBom(recipe: ManufacturingRecipeOption | undefined): boolean {
  return recipe?.componentCount === 0;
}

export function productionFailureMessage(
  error: unknown,
  options: { previewHadConsumableLines?: boolean } = {},
): string {
  if (error instanceof ApiError) {
    const details = error.errorDetails;
    const reason = detailString(details, "reason");

    if (reason === "recipe_has_no_components" || reason === "recipe_has_no_component_quantity") {
      return options.previewHadConsumableLines
        ? PREVIEW_OUT_OF_SYNC_MESSAGE
        : EMPTY_BOM_PRODUCTION_MESSAGE;
    }

    if (reason === "recipe_components_not_consumable") {
      return "This recipe has BOM lines, but they cannot be consumed for manufacturing. Link each component to a stock-tracked product, ingredient, or inventory item before producing.";
    }

    if (
      reason === "recipe_component_inventory_missing" ||
      reason === "recipe_component_not_consumable"
    ) {
      return "This recipe has a component that cannot be consumed for manufacturing. Link the recipe line to an active stock-tracked inventory item in the production branch before producing.";
    }

    if (
      reason === "recipe_packaging_inventory_missing" ||
      reason === "recipe_packaging_not_consumable"
    ) {
      return "This recipe has a packaging line that cannot be consumed for manufacturing. Link the packaging line to active stock in the production branch before producing.";
    }

    if (reason === "stock_shortage") {
      const summary = shortageSummary(details);
      return summary
        ? `Production cannot be posted because required component or packaging stock is not available: ${summary}.`
        : "Production cannot be posted because required component or packaging stock is not available.";
    }

    if (reason === "zero_cost_inputs") {
      const items = detailStringList(details, "zero_cost_items");
      const itemSuffix = items.length > 0 ? ` Affected items: ${items.join(", ")}.` : "";
      return `Production cannot be posted because consumed components have zero inventory value. Add opening stock or receive purchase stock with a value before producing.${itemSuffix}`;
    }
  }

  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("no components to consume") ||
    normalizedMessage.includes("no component quantity to consume") ||
    normalizedMessage.includes("recipe has no components") ||
    normalizedMessage.includes("no ingredients or packaging") ||
    normalizedMessage.includes("no bom") ||
    normalizedMessage.includes("bom lines") ||
    (normalizedMessage.includes("recipe") &&
      normalizedMessage.includes("ingredient") &&
      normalizedMessage.includes("packaging"))
  ) {
    return EMPTY_BOM_PRODUCTION_MESSAGE;
  }

  if (
    normalizedMessage.includes("required component or packaging stock is not available") ||
    normalizedMessage.includes("not enough stock") ||
    normalizedMessage.includes("stock shortage")
  ) {
    return "Production cannot be posted because required component or packaging stock is not available.";
  }

  if (normalizedMessage.includes("production output already exists")) {
    return "This production batch already has an output record. Refresh the batch before trying again.";
  }

  if (
    normalizedMessage.includes("only draft, planned, or in_progress batches can be produced") ||
    normalizedMessage.includes("only draft, planned, or in_progress batches can be completed")
  ) {
    return "Only planned, draft, or in-progress batches can be produced.";
  }

  if (normalizedMessage.includes("unit conversion is not available yet")) {
    return `${message} Update the recipe or inventory item so the units match before producing.`;
  }

  if (
    normalizedMessage.includes("accounting") ||
    normalizedMessage.includes("journal") ||
    normalizedMessage.includes("ledger")
  ) {
    return `${message} Check accounting setup and journal mappings before producing.`;
  }

  if (
    (normalizedMessage.includes("zero") ||
      normalizedMessage.includes("no value") ||
      normalizedMessage.includes("unit cost") ||
      normalizedMessage.includes("stock value") ||
      normalizedMessage.includes("inventory value")) &&
    (normalizedMessage.includes("cost") || normalizedMessage.includes("value"))
  ) {
    return `${message} Add opening stock or receive purchase stock with a value before producing.`;
  }

  return message;
}
