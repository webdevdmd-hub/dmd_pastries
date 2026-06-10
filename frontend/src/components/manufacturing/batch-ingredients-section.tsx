import type { JSX } from "react";

import {
  AccountingJournalLink,
  StockMovementLink,
} from "@/components/shared/accounting-reference-links";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionBatchIngredient } from "@/types/manufacturing";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function componentName(ingredient: ProductionBatchIngredient): string {
  return ingredient.componentProductName ?? ingredient.itemName;
}

function componentMeta(ingredient: ProductionBatchIngredient): string {
  const parts = [
    ingredient.componentProductType
      ? PRODUCT_TYPE_LABELS[ingredient.componentProductType]
      : "Legacy item",
    ingredient.componentVariantName,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" / ");
}

export function BatchIngredientsSection({
  ingredients,
}: {
  ingredients: ProductionBatchIngredient[];
}): JSX.Element {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-300 p-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-neutral-950">
            Components Consumed
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Backend-generated ingredient and material stock-out rows for this production.
          </p>
        </div>
      </div>
      <Table>
        <TableHeader className="bg-neutral-50">
          <TableRow className="border-neutral-300 hover:bg-neutral-50">
            <TableHead>Product</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>Consumed</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Journal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.map((ingredient) => (
            <TableRow className="border-neutral-200 hover:bg-neutral-50" key={ingredient.id}>
              <TableCell>
                <p className="font-semibold text-neutral-950">{componentName(ingredient)}</p>
                <p className="text-xs text-neutral-500">{componentMeta(ingredient)}</p>
              </TableCell>
              <TableCell className="font-mono">
                {ingredient.requiredQuantity} {ingredient.unitSymbol || ingredient.unitName}
              </TableCell>
              <TableCell className="font-mono">
                {ingredient.consumedQuantity} {ingredient.unitSymbol || ingredient.unitName}
              </TableCell>
              <TableCell>
                <p className="font-mono">{formatMoney(ingredient.totalCost)}</p>
                {ingredient.unitCostSnapshot > 0 ? (
                  <p className="text-xs text-neutral-500">
                    Unit {formatMoney(ingredient.unitCostSnapshot)}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <StockMovementLink id={ingredient.stockMovementId} />
              </TableCell>
              <TableCell>
                <AccountingJournalLink id={ingredient.accountingJournalEntryId} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
