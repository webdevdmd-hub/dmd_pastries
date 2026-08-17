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
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <h2 className="text-sm font-bold text-foreground">Packaging Consumed</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Backend-generated packaging stock-out rows for this production.
        </p>
      </div>
      <Table>
        <TableHeader className="bg-muted">
          <TableRow className="border-border hover:bg-muted">
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
            <TableRow className="border-border hover:bg-muted" key={item.id}>
              <TableCell>
                <p className="font-semibold text-foreground">{componentName(item)}</p>
                <p className="text-xs text-foreground-muted">{componentMeta(item)}</p>
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
                      <p className="text-xs text-foreground-muted">
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
