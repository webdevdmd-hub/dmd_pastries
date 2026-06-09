import type { JSX } from "react";

import {
  AccountingJournalLink,
  StockMovementLink,
} from "@/components/shared/accounting-reference-links";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="bg-white/85">
      <CardHeader>
        <CardTitle>Packaging</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Packaging</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Consumed</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Journal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packaging.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-semibold text-brand-espresso">{componentName(item)}</p>
                  <p className="text-xs text-brand-mocha">{componentMeta(item)}</p>
                </TableCell>
                <TableCell>{item.requiredQuantity}</TableCell>
                <TableCell>{item.consumedQuantity}</TableCell>
                <TableCell>{item.unitSymbol || item.unitName}</TableCell>
                <TableCell>
                  {item.totalCost > 0 ? (
                    <div>
                      <p>{formatMoney(item.totalCost)}</p>
                      {item.unitCostSnapshot > 0 ? (
                        <p className="text-xs text-brand-mocha">
                          Unit {formatMoney(item.unitCostSnapshot)}
                        </p>
                      ) : null}
                    </div>
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
      </CardContent>
    </Card>
  );
}
