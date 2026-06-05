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

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
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
                <TableCell className="font-semibold text-brand-espresso">
                  {item.packagingName}
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
