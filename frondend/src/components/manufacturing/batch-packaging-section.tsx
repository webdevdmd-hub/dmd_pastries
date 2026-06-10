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
import type { ProductionBatchPackaging } from "@/types/manufacturing";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function componentName(item: ProductionBatchPackaging): string {
  return item.componentProductName ?? item.packagingName;
}

function componentMeta(item: ProductionBatchPackaging): string {
  const parts = [
    item.componentProductType ? PRODUCT_TYPE_LABELS[item.componentProductType] : "Legacy item",
    item.componentVariantName,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" / ");
}

export function BatchPackagingSection({
  packaging,
}: {
  packaging: ProductionBatchPackaging[];
}): JSX.Element {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-300 bg-white">
      <div className="border-b border-neutral-300 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-neutral-950">
          Packaging Consumed
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Backend-generated packaging stock-out rows for this production.
        </p>
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
          {packaging.map((item) => (
            <TableRow className="border-neutral-200 hover:bg-neutral-50" key={item.id}>
              <TableCell>
                <p className="font-semibold text-neutral-950">{componentName(item)}</p>
                <p className="text-xs text-neutral-500">{componentMeta(item)}</p>
              </TableCell>
              <TableCell className="font-mono">
                {item.requiredQuantity} {item.unitSymbol || item.unitName}
              </TableCell>
              <TableCell className="font-mono">
                {item.consumedQuantity} {item.unitSymbol || item.unitName}
              </TableCell>
              <TableCell>
                {item.totalCost > 0 ? (
                  <>
                    <p className="font-mono">{formatMoney(item.totalCost)}</p>
                    {item.unitCostSnapshot > 0 ? (
                      <p className="text-xs text-neutral-500">
                        Unit {formatMoney(item.unitCostSnapshot)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <StockMovementLink id={item.stockMovementId} />
              </TableCell>
              <TableCell>
                <AccountingJournalLink id={item.accountingJournalEntryId} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
